'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Coins, Loader2, LogOut, RotateCcw, Volume2, VolumeX } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import { BoardChain } from '@/components/domino/board-chain'
import { DominoTile } from '@/components/domino/domino-tile'
import { GameLog } from '@/components/domino/game-log'
import { Lobby, type ProfileData } from '@/components/domino/lobby'
import { ResultDialog } from '@/components/domino/result-dialog'
import { Seat } from '@/components/domino/seat'
import { SidePickerDialog } from '@/components/domino/side-picker-dialog'

import { chooseBotMove, createGame, getEnds, potFor, sidesFor } from '@/lib/game/engine'
import { gameReducer } from '@/lib/game/reducer'
import type { Side, Stake, Tile } from '@/lib/game/types'
import { SEAT_NAMES } from '@/lib/game/types'
import { loadSfxMuted, playSfx, setSfxMuted } from '@/lib/sfx'
import { cn } from '@/lib/utils'

type Screen = 'lobby' | 'game'
type ProfileStatus = 'loading' | 'ready' | 'error'

interface ServerOutcomeBody {
  outcome: 'win' | 'loss' | 'draw' | 'forfeit'
  payout: number
}

/** Píldora del pozo: vive fuera del fieltro, en la fila de controles */
function PotPill({ pot }: { pot: number }) {
  return (
    <span
      className="flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-zinc-900/85 px-3 py-1.5 text-xs font-bold text-amber-300 shadow"
      aria-label={`Pozo: ${pot} tokens`}
    >
      <span className="relative h-4 w-6" aria-hidden>
        <span className="absolute inset-x-0 bottom-0 h-3.5 rounded-full border-2 border-white/70 bg-red-500" />
        <span className="absolute inset-x-0 bottom-1 h-3.5 rounded-full border-2 border-white/80 bg-amber-400" />
      </span>
      Pozo: {pot}
    </span>
  )
}

export default function DominoPage() {
  const [screen, setScreen] = useState<Screen>('lobby')
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('loading')
  const [state, dispatch] = useReducer(gameReducer, null)
  const [stake, setStake] = useState<Stake>(100)
  const [joiningStake, setJoiningStake] = useState<Stake | null>(null)
  const [replaying, setReplaying] = useState(false)
  const [sidePicker, setSidePicker] = useState<{ tile: Tile; sides: Side[] } | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [shakeTileId, setShakeTileId] = useState<number | null>(null)
  const [muted, setMuted] = useState(false)
  const [bonusLoading, setBonusLoading] = useState(false)

  const reportedRef = useRef<unknown>(null)
  const prevPhaseRef = useRef<'playing' | 'finished' | null>(null)
  const joinInFlightRef = useRef(false)
  const lastJoinAtRef = useRef(0)
  const leavingRef = useRef(false)

  // ---------- Perfil ----------
  const refreshProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/profile', { cache: 'no-store' })
      if (!res.ok) throw new Error('profile')
      const data = (await res.json()) as ProfileData
      setProfile(data)
      setProfileStatus('ready')
    } catch {
      setProfileStatus('error')
    }
  }, [])

  useEffect(() => {
    void refreshProfile()
  }, [refreshProfile])

  useEffect(() => {
    setMuted(loadSfxMuted())
  }, [])

  // ---------- Entrar a una mesa ----------
  const joinTable = useCallback(
    async (tableStake: Stake) => {
      // Evita doble cobro por doble click o eventos duplicados
      const now = Date.now()
      if (joinInFlightRef.current || now - lastJoinAtRef.current < 800) return
      joinInFlightRef.current = true
      lastJoinAtRef.current = now
      setJoiningStake(tableStake)
      try {
        const res = await fetch('/api/game/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stake: tableStake }),
        })
        const data = (await res.json()) as { tokens?: number; error?: string }
        const newTokens = data.tokens
        if (!res.ok || typeof newTokens !== 'number') {
          toast.error(data.error ?? 'No se pudo entrar a la mesa.')
          return
        }
        setProfile((prev) => (prev ? { ...prev, tokens: newTokens } : prev))
        setStake(tableStake)
        reportedRef.current = null
        prevPhaseRef.current = 'playing'
        dispatch({ type: 'SET_GAME', state: createGame(tableStake) })
        setScreen('game')
        playSfx('deal')
      } catch {
        toast.error('Error de conexión con el servidor.')
      } finally {
        joinInFlightRef.current = false
        setJoiningStake(null)
      }
    },
    [],
  )

  // ---------- Bucle de los bots ----------
  useEffect(() => {
    if (!state || state.phase !== 'playing' || state.turn === 0) return
    const botSeat = state.turn
    const timer = setTimeout(
      () => {
        const requiredId =
          state.chain.length === 0 && botSeat === state.starter ? state.requiredFirstTileId : null
        const move = chooseBotMove(state.hands[botSeat], state.chain, requiredId)
        if (move) {
          dispatch({ type: 'APPLY_PLAY', player: botSeat, tileId: move.tile.id, side: move.side })
          playSfx('click')
        } else {
          dispatch({ type: 'APPLY_PASS', player: botSeat })
          playSfx('pass')
        }
      },
      850 + Math.random() * 550,
    )
    return () => clearTimeout(timer)
  }, [state])

  // ---------- Fin de partida: reportar al servidor ----------
  useEffect(() => {
    if (!state) return
    if (prevPhaseRef.current !== state.phase) {
      if (state.phase === 'finished' && state.outcome) {
        playSfx(state.outcome.payout > 0 ? 'win' : 'lose')
      }
      prevPhaseRef.current = state.phase
    }

    if (state.phase !== 'finished' || !state.outcome) return
    if (reportedRef.current === state) return
    reportedRef.current = state

    const outcome = state.outcome
    const body: ServerOutcomeBody = {
      outcome:
        outcome.type === 'win' || outcome.type === 'blocked-win'
          ? 'win'
          : outcome.type === 'forfeit'
            ? 'forfeit'
            : 'loss',
      payout: outcome.payout,
    }

    void (async () => {
      try {
        const res = await fetch('/api/game/result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stake: state.stake, ...body }),
        })
        if (!res.ok) throw new Error('result')
        const data = (await res.json()) as { tokens: number }
        setProfile((prev) =>
          prev
            ? { ...prev, tokens: data.tokens, stats: { ...prev.stats } }
            : prev,
        )
      } catch {
        toast.error('No se pudo registrar el resultado en el servidor.')
      } finally {
        void refreshProfile()
      }
    })()
  }, [state, refreshProfile])

  // ---------- Acciones del humano ----------
  const myTurn = !!state && state.phase === 'playing' && state.turn === 0

  const playableIds = useMemo(() => {
    const empty = new Set<number>()
    if (!state || state.phase !== 'playing' || state.turn !== 0) return empty
    if (state.chain.length === 0 && state.requiredFirstTileId !== null) {
      return state.starter === 0 ? new Set([state.requiredFirstTileId]) : empty
    }
    return new Set(
      state.hands[0].filter((t) => sidesFor(t, state.chain).length > 0).map((t) => t.id),
    )
  }, [state])

  const canPass = myTurn && !!state && state.chain.length > 0 && playableIds.size === 0

  const playTile = useCallback(
    (tile: Tile, side: Side) => {
      setSidePicker(null)
      setShakeTileId(null)
      dispatch({ type: 'APPLY_PLAY', player: 0, tileId: tile.id, side })
      playSfx('click')
    },
    [],
  )

  const handleTileClick = useCallback(
    (tile: Tile) => {
      if (!state || state.phase !== 'playing') return
      if (state.turn !== 0) {
        toast.info('No es tu turno.', { description: 'Espera a que jueguen los bots.' })
        return
      }
      if (
        state.chain.length === 0 &&
        state.requiredFirstTileId !== null &&
        tile.id !== state.requiredFirstTileId
      ) {
        const required = state.hands[0].find((t) => t.id === state.requiredFirstTileId)
        if (required) {
          toast.warning('Apertura obligatoria', {
            description: `Debes abrir la cadena con el doble más alto [${required.a}|${required.b}].`,
          })
          return
        }
      }
      const sides = sidesFor(tile, state.chain)
      if (sides.length === 0) {
        setShakeTileId(tile.id)
        window.setTimeout(() => setShakeTileId((current) => (current === tile.id ? null : current)), 450)
        toast.error('Esa ficha no encaja en ningún extremo de la cadena.')
        return
      }
      if (sides.length === 1) {
        playTile(tile, sides[0])
      } else {
        setSidePicker({ tile, sides })
      }
    },
    [state, playTile],
  )

  const handlePass = useCallback(() => {
    if (!myTurn) return
    dispatch({ type: 'APPLY_PASS', player: 0 })
    playSfx('pass')
    toast.info('Pasaste tu turno.')
  }, [myTurn])

  const handleLeave = useCallback(async () => {
    if (leavingRef.current) return
    leavingRef.current = true
    setConfirmLeave(false)
    if (state && state.phase === 'playing') {
      reportedRef.current = { forfeited: true }
      try {
        await fetch('/api/game/result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stake: state.stake, outcome: 'forfeit', payout: 0 }),
        })
        toast.info('Abandonaste la mesa.', {
          description: `Se perdió tu apuesta de ${state.stake} tokens.`,
        })
      } catch {
        /* la partida local se descarta igualmente */
      }
    }
    dispatch({ type: 'RESET' })
    setSidePicker(null)
    prevPhaseRef.current = null
    setScreen('lobby')
    leavingRef.current = false
    void refreshProfile()
  }, [state, refreshProfile])

  const handleClaimBonus = useCallback(async () => {
    setBonusLoading(true)
    try {
      const res = await fetch('/api/profile/bonus', { method: 'POST' })
      const data = (await res.json()) as { granted: boolean; tokens: number }
      if (data.granted) {
        toast.success('¡Bonus reclamado!', { description: '+500 tokens añadidos a tu saldo.' })
        playSfx('coin')
      } else {
        toast.info('Bonus no disponible', {
          description: 'Solo puedes reclamar el bonus cuando tienes menos de 100 tokens.',
        })
      }
      void refreshProfile()
    } catch {
      toast.error('No se pudo reclamar el bonus.')
    } finally {
      setBonusLoading(false)
    }
  }, [refreshProfile])

  // ---------- Valores derivados para la UI ----------
  const ends = state ? getEnds(state.chain) : null
  const botCounts: [number, number, number] = state
    ? [state.hands[1].length, state.hands[2].length, state.hands[3].length]
    : [7, 7, 7]
  const activeSeat = state && state.phase === 'playing' ? state.turn : null

  const statusText = useMemo(() => {
    if (!state) return ''
    if (state.phase === 'finished') return 'Partida terminada'
    if (state.turn === 0) {
      if (state.chain.length === 0 && state.requiredFirstTileId !== null) {
        const required = state.hands[0].find((t) => t.id === state.requiredFirstTileId)
        return required
          ? `Es tu turno · abre la cadena con [${required.a}|${required.b}]`
          : 'Es tu turno'
      }
      return playableIds.size > 0
        ? 'Es tu turno · toca una ficha para jugarla'
        : 'Es tu turno · no tienes jugada disponible'
    }
    return `Turno de ${SEAT_NAMES[state.turn]}…`
  }, [state, playableIds.size])

  const tokensForBadge = profile?.tokens ?? 0
  const canReplay = profile !== null && profile.tokens >= stake

  return (
    <div className="domino-bg flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Encabezado */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-zinc-950/90 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/75">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden>
              🀄
            </span>
            <h1 className="text-lg font-black tracking-tight sm:text-xl">
              Salón de Dominó <span className="text-emerald-400">Online</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="gap-1.5 border-amber-500/50 bg-zinc-900 px-3 py-1.5 text-sm font-bold text-amber-400"
              aria-label={`Saldo: ${tokensForBadge} tokens`}
            >
              <Coins className="h-4 w-4" aria-hidden />
              {tokensForBadge.toLocaleString('es')}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 text-zinc-400 hover:text-zinc-100"
              onClick={() => {
                const next = !muted
                setMuted(next)
                setSfxMuted(next)
              }}
              aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
              aria-pressed={muted}
            >
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {screen === 'lobby' ? (
          profileStatus === 'loading' ? (
            <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Cargando perfil">
              <div className="flex flex-col items-center gap-3 text-zinc-400">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" aria-hidden />
                <p className="text-sm">Cargando tu salón…</p>
              </div>
            </div>
          ) : profileStatus === 'error' ? (
            <Card className="mx-auto max-w-md border-red-500/40 bg-red-950/30">
              <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                <p className="text-lg font-bold text-red-400">No se pudo cargar tu perfil</p>
                <p className="text-sm text-zinc-400">
                  Revisa tu conexión e inténtalo de nuevo para ver tus tokens y mesas.
                </p>
                <Button
                  onClick={() => {
                    setProfileStatus('loading')
                    void refreshProfile()
                  }}
                  variant="outline"
                  className="min-h-11 border-zinc-700"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden /> Reintentar
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Lobby
              profile={profile}
              joiningStake={joiningStake}
              onJoin={(s) => void joinTable(s)}
              onClaimBonus={() => void handleClaimBonus()}
              bonusLoading={bonusLoading}
            />
          )
        ) : (
          state && (
            <div className="mx-auto w-full max-w-5xl">
              {/* Estado y controles de la mesa */}
              <div className="mb-4 flex flex-col items-center gap-2">
                <p
                  aria-live="polite"
                  className={cn(
                    'rounded-full border px-4 py-1.5 text-center text-sm font-bold shadow-lg',
                    state.phase === 'finished'
                      ? 'border-amber-400/60 bg-amber-400/15 text-amber-300'
                      : myTurn
                        ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-300'
                        : 'border-white/10 bg-zinc-900/85 text-zinc-300',
                  )}
                >
                  {statusText}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="flex items-center gap-1 rounded-full border border-white/10 bg-zinc-900/85 px-3 py-1.5 text-xs font-semibold text-zinc-300 shadow">
                    Apuesta: <span className="font-bold text-amber-400">{state.stake} 🪙</span>
                  </span>
                  <PotPill pot={potFor(state.stake)} />
                  <span
                    className="flex items-center gap-1.5 rounded-full border border-white/10 bg-zinc-900/85 px-3 py-1.5 text-xs font-semibold text-zinc-400 shadow"
                    aria-label="Extremos de la cadena"
                  >
                    <span>Extremos:</span>
                    <span className="font-bold text-zinc-100">[ {ends ? ends.left : '—'} ]</span>
                    <span aria-hidden>⟷</span>
                    <span className="font-bold text-zinc-100">[ {ends ? ends.right : '—'} ]</span>
                  </span>
                  {canPass && (
                    <Button
                      onClick={handlePass}
                      className="min-h-9 animate-pulse rounded-full bg-amber-400 px-4 text-xs font-black text-zinc-950 shadow-[0_6px_16px_rgba(251,191,36,0.4)] hover:bg-amber-300"
                    >
                      ⏭ Pasar turno
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-9 gap-1.5 text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
                    onClick={() => setConfirmLeave(true)}
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    Salir
                  </Button>
                </div>
              </div>

              {/* Rivales alrededor de la mesa: perfiles y sus fichas en mano, FUERA del fieltro */}
              <div className="mb-2 flex items-end justify-between gap-1 md:mb-3 md:justify-center">
                <Seat
                  seat={2}
                  count={botCounts[1]}
                  active={activeSeat === 2}
                  className="md:hidden"
                />
                <Seat seat={1} count={botCounts[0]} active={activeSeat === 1} />
                <Seat
                  seat={3}
                  count={botCounts[2]}
                  active={activeSeat === 3}
                  className="md:hidden"
                />
              </div>

              <div className="flex items-center justify-center gap-2 sm:gap-4">
                {/* Max a la izquierda (escritorio) */}
                <Seat
                  seat={2}
                  count={botCounts[1]}
                  active={activeSeat === 2}
                  className="hidden shrink-0 md:flex"
                />

                <div className="min-w-0 flex-1">
                  {/* Mesa estilo Plato: sobre el fieltro SOLO las fichas jugadas */}
                  <div className="plato-table relative select-none rounded-[2rem] border-[6px] border-emerald-800 p-[6px] sm:rounded-[2.75rem] sm:border-8 sm:p-2">
                    <div className="plato-felt relative flex min-h-[400px] items-center justify-center overflow-hidden rounded-[1.5rem] p-3 sm:min-h-[440px] sm:rounded-[2rem] sm:p-4">
                      <BoardChain chain={state.chain} />
                    </div>
                  </div>

                  {/* Tu perfil y tu mano, fuera de la mesa */}
                  <section aria-label="Tus fichas" className="relative z-20 -mt-2 px-2 sm:-mt-3">
                    <div className="mx-auto flex w-fit max-w-full flex-wrap items-end justify-center gap-x-2.5 gap-y-3">
                      <Seat
                        seat={0}
                        count={state.hands[0].length}
                        active={myTurn}
                        hideStack
                        className="mr-1 self-end"
                      />
                      {state.hands[0].map((tile, index) => {
                        const isPlayable = playableIds.has(tile.id)
                        return (
                          <motion.div
                            key={tile.id}
                            initial={{ opacity: 0, y: 26, scale: 0.75 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{
                              delay: index * 0.045,
                              type: 'spring',
                              stiffness: 420,
                              damping: 26,
                            }}
                          >
                            <DominoTile
                              size="lg"
                              top={tile.a}
                              bottom={tile.b}
                              playable={isPlayable}
                              disabled={!isPlayable}
                              highlight={
                                state.chain.length === 0 &&
                                state.requiredFirstTileId === tile.id &&
                                state.starter === 0
                              }
                              onClick={() => handleTileClick(tile)}
                              className={cn(shakeTileId === tile.id && 'domino-shake')}
                              ariaLabel={`Ficha ${tile.a} y ${tile.b}${isPlayable ? ', jugable' : ''}`}
                            />
                          </motion.div>
                        )
                      })}
                    </div>
                  </section>
                </div>

                {/* Kira a la derecha (escritorio) */}
                <Seat
                  seat={3}
                  count={botCounts[2]}
                  active={activeSeat === 3}
                  className="hidden shrink-0 md:flex"
                />
              </div>

              {/* Bitácora */}
              <div className="mt-6">
                <GameLog entries={state.log} />
              </div>
            </div>
          )
        )}
      </main>

      {/* Pie pegado al fondo */}
      <footer className="mt-auto border-t border-white/5 bg-zinc-950 py-4">
        <p className="px-4 text-center text-xs text-zinc-600">
          🀄 Salón de Dominó · Tokens virtuales solo para diversión · Juega con responsabilidad
        </p>
      </footer>

      {/* Diálogos */}
      <SidePickerDialog
        open={sidePicker !== null}
        tile={sidePicker?.tile ?? null}
        sides={sidePicker?.sides ?? []}
        chainEnds={ends}
        onChoose={(side) => sidePicker && playTile(sidePicker.tile, side)}
        onCancel={() => setSidePicker(null)}
      />

      <ResultDialog
        open={!!state?.phase && state.phase === 'finished' && state.outcome?.type !== 'forfeit'}
        outcome={state?.outcome ?? null}
        stake={state?.stake ?? stake}
        canReplay={canReplay}
        replaying={replaying || joiningStake !== null}
        onReplay={() => {
          setReplaying(true)
          void joinTable(stake).finally(() => setReplaying(false))
        }}
        onLobby={() => {
          dispatch({ type: 'RESET' })
          prevPhaseRef.current = null
          setScreen('lobby')
          void refreshProfile()
        }}
      />

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent className="border-zinc-700 bg-zinc-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">¿Abandonar la mesa?</AlertDialogTitle>
            <AlertDialogDescription>
              Si abandonas ahora perderás tu apuesta de{' '}
              <strong className="text-amber-400">{state?.stake ?? stake} tokens</strong>. El pozo se
              quedará en la mesa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
              Seguir jugando
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleLeave()}
              className="bg-red-600 text-white hover:bg-red-500"
            >
              Abandonar y perder apuesta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
