'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Coins, Loader2, RotateCcw, Volume2, VolumeX } from 'lucide-react'

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
import { OpponentRail } from '@/components/domino/opponent-rail'
import { ResultDialog } from '@/components/domino/result-dialog'
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
      if (joinInFlightRef.current) return
      joinInFlightRef.current = true
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
        ? 'Es tu turno · haz clic en una ficha para jugarla'
        : 'Es tu turno · no tienes jugada disponible'
    }
    return `Turno de ${SEAT_NAMES[state.turn]}…`
  }, [state, playableIds.size])

  const tokensForBadge = profile?.tokens ?? 0
  const canReplay = profile !== null && profile.tokens >= stake

  return (
    <div className="domino-bg flex min-h-screen flex-col bg-slate-950 text-slate-100">
      {/* Encabezado */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur supports-[backdrop-filter]:bg-slate-950/75">
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
              className="gap-1.5 border-amber-500/50 bg-slate-900 px-3 py-1.5 text-sm font-bold text-amber-400"
              aria-label={`Saldo: ${tokensForBadge} tokens`}
            >
              <Coins className="h-4 w-4" aria-hidden />
              {tokensForBadge.toLocaleString('es')}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 text-slate-400 hover:text-slate-100"
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
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" aria-hidden />
                <p className="text-sm">Cargando tu salón…</p>
              </div>
            </div>
          ) : profileStatus === 'error' ? (
            <Card className="mx-auto max-w-md border-red-500/40 bg-red-950/30">
              <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                <p className="text-lg font-bold text-red-400">No se pudo cargar tu perfil</p>
                <p className="text-sm text-slate-400">
                  Revisa tu conexión e inténtalo de nuevo para ver tus tokens y mesas.
                </p>
                <Button
                  onClick={() => {
                    setProfileStatus('loading')
                    void refreshProfile()
                  }}
                  variant="outline"
                  className="min-h-11 border-slate-700"
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
            <div className="space-y-4">
              {/* Cabecera de la mesa */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-300">
                  <span>
                    Apuesta: <strong className="text-slate-100">{state.stake} 🪙</strong>
                  </span>
                  <span>
                    Pozo:{' '}
                    <strong className="text-amber-400">{potFor(state.stake)} 🪙</strong>
                  </span>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="min-h-11 bg-red-600 hover:bg-red-500"
                  onClick={() => setConfirmLeave(true)}
                >
                  Abandonar mesa
                </Button>
              </div>

              {/* Oponentes */}
              <OpponentRail
                counts={botCounts}
                activeSeat={state.phase === 'playing' && state.turn !== 0 ? state.turn : null}
              />

              {/* Estado y extremos */}
              <div className="space-y-1 text-center">
                <p
                  aria-live="polite"
                  className={cn(
                    'text-sm font-bold sm:text-base',
                    state.phase === 'finished'
                      ? 'text-amber-400'
                      : state.turn === 0
                        ? 'text-emerald-400'
                        : 'text-slate-400',
                  )}
                >
                  {statusText}
                </p>
                <p className="text-xs text-slate-500" aria-label="Extremos de la cadena">
                  Extremos de la cadena:{' '}
                  <strong className="text-slate-300">
                    [ {ends ? ends.left : '—'} ] ⟷ [ {ends ? ends.right : '—'} ]
                  </strong>
                </p>
              </div>

              {/* Cadena en la mesa */}
              <BoardChain chain={state.chain} lastSide={state.lastSide} revision={state.chain.length} />

              {/* Mano del jugador */}
              <section aria-label="Tus fichas">
                <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-300">
                    Tus fichas ({state.hands[0].length}){' '}
                    {state.starter === 0 && (
                      <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                        abriste la cadena
                      </span>
                    )}
                  </h2>
                  {canPass && (
                    <Button
                      onClick={handlePass}
                      variant="outline"
                      className="min-h-11 animate-pulse border-amber-500/60 bg-amber-500/10 font-bold text-amber-400 hover:bg-amber-500/20 hover:text-amber-300"
                    >
                      ⏭ Pasar turno
                    </Button>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap justify-center gap-2 sm:gap-3">
                  {state.hands[0].map((tile) => {
                    const isPlayable = playableIds.has(tile.id)
                    return (
                      <DominoTile
                        key={tile.id}
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
                    )
                  })}
                </div>
              </section>

              <GameLog entries={state.log} />
            </div>
          )
        )}
      </main>

      {/* Pie pegado al fondo */}
      <footer className="mt-auto border-t border-slate-800 bg-slate-950 py-4">
        <p className="px-4 text-center text-xs text-slate-600">
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
        <AlertDialogContent className="border-slate-700 bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">¿Abandonar la mesa?</AlertDialogTitle>
            <AlertDialogDescription>
              Si abandonas ahora perderás tu apuesta de{' '}
              <strong className="text-amber-400">{state?.stake ?? stake} tokens</strong>. El pozo se
              quedará en la mesa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-slate-100">
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

