'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { LogOut, Play, Volume2, VolumeX } from 'lucide-react'

import { Button } from '@/components/ui/button'
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
import { ResultDialog } from '@/components/domino/result-dialog'
import { Seat } from '@/components/domino/seat'
import { SidePickerDialog } from '@/components/domino/side-picker-dialog'

import { chooseBotMove, createGame, getEnds, sidesFor } from '@/lib/game/engine'
import { gameReducer } from '@/lib/game/reducer'
import type { Side, Tile } from '@/lib/game/types'
import { SEAT_NAMES } from '@/lib/game/types'
import { getMutedSnapshot, playSfx, setSfxMuted, subscribeMuted } from '@/lib/sfx'
import { cn } from '@/lib/utils'

export default function DominoPage() {
  const [state, dispatch] = useReducer(gameReducer, null)
  const [sidePicker, setSidePicker] = useState<{ tile: Tile; sides: Side[] } | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [shakeTileId, setShakeTileId] = useState<number | null>(null)
  /** El mute vive fuera de React (módulo sfx + localStorage): sin efectos ni hidratación frágil */
  const muted = useSyncExternalStore(subscribeMuted, getMutedSnapshot, () => false)

  const prevPhaseRef = useRef<'playing' | 'finished' | null>(null)

  // ---------- Sonido al terminar la partida ----------
  useEffect(() => {
    if (!state) {
      prevPhaseRef.current = null
      return
    }
    if (prevPhaseRef.current !== state.phase) {
      if (state.phase === 'finished' && state.outcome) {
        playSfx(state.outcome.type === 'win' || state.outcome.type === 'blocked-win' ? 'win' : 'lose')
      }
      prevPhaseRef.current = state.phase
    }
  }, [state])

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

  // ---------- Valores derivados para la UI ----------
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

  // ---------- Acciones ----------
  const startGame = useCallback(() => {
    setSidePicker(null)
    setShakeTileId(null)
    prevPhaseRef.current = 'playing'
    dispatch({ type: 'SET_GAME', state: createGame() })
    playSfx('deal')
  }, [])

  const playTile = useCallback((tile: Tile, side: Side) => {
    setSidePicker(null)
    setShakeTileId(null)
    dispatch({ type: 'APPLY_PLAY', player: 0, tileId: tile.id, side })
    playSfx('click')
  }, [])

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

  const handleLeave = useCallback(() => {
    setConfirmLeave(false)
    dispatch({ type: 'RESET' })
    setSidePicker(null)
    prevPhaseRef.current = null
    toast.info('Saliste de la partida.')
  }, [])

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

          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 text-zinc-400 hover:text-zinc-100"
            onClick={() => {
              setSfxMuted(!muted)
            }}
            aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
            aria-pressed={muted}
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {state ? (
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

            {/* Rivales alrededor de la mesa: perfiles y sus fichas en mano, FUERA del fieltro.
                ORDEN DE JUEGO: desde la primera ficha, el turno pasa SIEMPRE a la DERECHA de cada jugador:
                Tú(abajo) → Kira(derecha) → Max(frente) → Lola(izquierda) → Tú */}
            <div className="mb-2 flex items-end justify-between gap-1 md:mb-3 md:justify-center">
              <Seat
                seat={1}
                count={botCounts[0]}
                active={activeSeat === 1}
                className="md:hidden"
              />
              <Seat seat={2} count={botCounts[1]} active={activeSeat === 2} />
              <Seat
                seat={3}
                count={botCounts[2]}
                active={activeSeat === 3}
                className="md:hidden"
              />
            </div>

            <div className="flex items-center justify-center gap-2 sm:gap-4">
              {/* Lola a la izquierda (escritorio): recibe el turno desde el frente y lo devuelve a Tú */}
              <Seat
                seat={1}
                count={botCounts[0]}
                active={activeSeat === 1}
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

              {/* Kira a la derecha (escritorio): recibe el turno de Tú — el juego corre hacia la derecha */}
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
        ) : (
          /* Mesa vacía: invitación a jugar */
          <div className="mx-auto w-full max-w-3xl">
            <div className="plato-table relative select-none rounded-[2rem] border-[6px] border-emerald-800 p-[6px] sm:rounded-[2.75rem] sm:border-8 sm:p-2">
              <div className="plato-felt relative flex min-h-[400px] flex-col items-center justify-center gap-5 overflow-hidden rounded-[1.5rem] p-3 sm:min-h-[440px] sm:rounded-[2rem] sm:p-4">
                {/* Fichas decorativas FUERA del botón: un <button> no puede contener otro <button> */}
                <span className="flex items-end gap-3" aria-hidden>
                  <DominoTile
                    top={6}
                    bottom={6}
                    size="md"
                    orientation="vertical"
                    className="rotate-[-8deg] shadow-lg"
                  />
                  <DominoTile
                    top={5}
                    bottom={2}
                    size="md"
                    orientation="vertical"
                    className="rotate-[7deg] shadow-lg"
                  />
                </span>
                <button
                  onClick={startGame}
                  className="flex flex-col items-center gap-2.5 rounded-3xl border-2 border-emerald-300/40 bg-emerald-400/10 px-9 py-6 shadow-inner transition-all hover:border-emerald-300/70 hover:bg-emerald-400/20 active:scale-[0.98] sm:px-14"
                  aria-label="Jugar una partida de dominó"
                >
                  <span className="flex items-center gap-2.5 text-2xl font-black tracking-wide text-emerald-100 sm:text-3xl">
                    <Play className="h-6 w-6 fill-current sm:h-7 sm:w-7" aria-hidden />
                    Jugar
                  </span>
                  <span className="text-xs font-semibold text-emerald-200/70 sm:text-sm">
                    4 jugadores · el doble más alto abre la partida
                  </span>
                </button>
              </div>
            </div>

            <p className="mt-4 text-center text-sm text-zinc-500">
              El turno corre hacia la derecha: Tú → Kira → Max → Lola
            </p>
          </div>
        )}
      </main>

      {/* Pie pegado al fondo */}
      <footer className="mt-auto border-t border-white/5 bg-zinc-950 py-4">
        <p className="px-4 text-center text-xs text-zinc-600">
          🀄 Salón de Dominó · Juego clásico de dominó para 4 jugadores
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
        open={!!state && state.phase === 'finished' && !!state.outcome}
        outcome={state?.outcome ?? null}
        onReplay={startGame}
        onClose={() => dispatch({ type: 'RESET' })}
      />

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent className="border-zinc-700 bg-zinc-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">¿Abandonar la partida?</AlertDialogTitle>
            <AlertDialogDescription>
              Si sales ahora la partida en curso se perderá. Podrás empezar otra cuando quieras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
              Seguir jugando
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleLeave} className="bg-red-600 text-white hover:bg-red-500">
              Abandonar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
