'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { LogOut, Volume2, VolumeX } from 'lucide-react'

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
import { TableIntro } from '@/components/domino/table-intro'

import { chooseBotMove, createGame, getEnds, sidesFor } from '@/lib/game/engine'
import { gameReducer } from '@/lib/game/reducer'
import type { Side, Tile } from '@/lib/game/types'
import { SEAT_NAMES } from '@/lib/game/types'
import { getMutedSnapshot, playSfx, setSfxMuted, subscribeMuted } from '@/lib/sfx'
import { cn } from '@/lib/utils'

// ---------- Placa cómic del botón JUGAR (silueta dentada tipo peg tearing) ----------

const BADGE_PATH =
  'M 44 14 L 62 6 L 76 16 L 94 12 L 106 20 L 120 12 L 142 8 L 154 16 L 176 12 ' +
  'L 192 3 L 206 13 L 228 12 L 240 18 L 254 10 L 272 14 Q 292 16 294 34 ' +
  'L 304 46 L 294 56 L 308 66 L 296 76 Q 298 92 280 98 L 264 106 L 250 98 ' +
  'L 232 102 L 220 92 L 206 102 L 186 100 L 172 112 L 158 100 L 138 102 ' +
  'L 124 92 L 112 102 L 92 100 L 78 110 L 64 100 L 48 102 Q 28 100 22 84 ' +
  'L 12 72 L 24 62 L 10 50 L 22 40 Q 24 20 44 14 Z'

// ---------- Panel de la bandera + portavasos de la mesa rústica ----------

/** Placa de cristal con la bandera de humo: oculta durante la intro hasta que cae el rayo */
function FlagPanel({ visible }: { visible: boolean }) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
      initial={false}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: visible ? 0.45 : 0.2, ease: 'easeOut' }}
      aria-hidden
    >
      <motion.img
        src="/bandera-panel.png"
        alt=""
        className="h-full w-full object-cover"
        animate={
          visible
            ? {
                scale: [1.07, 1],
                filter: ['brightness(2.4) contrast(1.15)', 'brightness(1) contrast(1)'],
              }
            : { scale: 1.07, filter: 'brightness(0.55)' }
        }
        transition={{ duration: 0.75, ease: 'easeOut' }}
      />
      {/* velo suave para que las fichas de marfil destaquen sobre el arte */}
      <div className="absolute inset-0 bg-black/30" />
      {/* reflejo de cristal pulido */}
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.09)_0%,transparent_30%,transparent_70%,rgba(255,255,255,0.05)_100%)]" />
    </motion.div>
  )
}

/** Portavasos empotrados en las cuatro esquinas del marco de madera */
function CornerCups() {
  return (
    <>
      <span aria-hidden className="mesa-cup absolute left-1.5 top-1.5 h-5 w-5 rounded-full sm:left-2 sm:top-2 sm:h-6 sm:w-6" />
      <span aria-hidden className="mesa-cup absolute right-1.5 top-1.5 h-5 w-5 rounded-full sm:right-2 sm:top-2 sm:h-6 sm:w-6" />
      <span aria-hidden className="mesa-cup absolute bottom-1.5 left-1.5 h-5 w-5 rounded-full sm:bottom-2 sm:left-2 sm:h-6 sm:w-6" />
      <span aria-hidden className="mesa-cup absolute bottom-1.5 right-1.5 h-5 w-5 rounded-full sm:bottom-2 sm:right-2 sm:h-6 sm:w-6" />
    </>
  )
}

// ---------- Drag & drop de fichas hacia la mesa ----------

interface DragState {
  tile: Tile
  /** lados donde la ficha encaja ahora mismo */
  sides: Side[]
  startX: number
  startY: number
  x: number
  y: number
  /** true cuando el arrastre superó el umbral: aparece la ficha fantasma y las zonas de suelta */
  active: boolean
  /** extremo que está bajo el puntero ahora mismo */
  hover: Side | null
}

interface DropZones {
  left: DOMRect[]
  right: DOMRect[]
}

/** Movimiento mínimo (px) para distinguir un arrastre de un simple toque */
const DRAG_THRESHOLD = 6
/** Amplitud de cada zona de suelta alrededor de su extremo (px) */
const ZONE_PAD = 44
/** Retardo del paso automático cuando no tienes jugada (ms) — como en la mesa real */
const AUTO_PASS_DELAY = 1250

/** Mide las zonas de suelta de la mesa: extremo izquierdo y extremo derecho de la cadena */
function collectDropZones(chainStarted: boolean): DropZones | null {
  if (typeof document === 'undefined') return null
  const zones: DropZones = { left: [], right: [] }
  if (!chainStarted) {
    const empty = document.querySelector<HTMLElement>('[data-end="empty"]')
    if (empty) {
      const r = empty.getBoundingClientRect()
      zones.left.push(r)
      zones.right.push(r)
    }
    return zones.left.length > 0 ? zones : null
  }
  const leftEl = document.querySelector<HTMLElement>('[data-end="left"], [data-end="both"]')
  const rightEl = document.querySelector<HTMLElement>('[data-end="right"], [data-end="both"]')
  const lr = leftEl?.getBoundingClientRect() ?? null
  const rr = rightEl?.getBoundingClientRect() ?? null
  if (lr && rr && Math.abs(lr.left - rr.left) < 1 && Math.abs(lr.width - rr.width) < 1) {
    // Con una sola ficha en la mesa ella misma es ambos extremos: mitad izquierda / mitad derecha
    zones.left.push(new DOMRect(lr.left, lr.top, lr.width / 2, lr.height))
    zones.right.push(new DOMRect(lr.left + lr.width / 2, lr.top, lr.width / 2, lr.height))
    zones.left.push(new DOMRect(lr.left - 80, lr.top, 80, lr.height))
    zones.right.push(new DOMRect(lr.right, lr.top, 80, lr.height))
  } else {
    if (lr) {
      zones.left.push(lr)
      // prolongación hacia fuera del extremo: ahí es donde apoyarías la ficha nueva
      zones.left.push(new DOMRect(lr.left - 90, lr.top, 90, lr.height))
    }
    if (rr) {
      zones.right.push(rr)
      zones.right.push(new DOMRect(rr.right, rr.top, 90, rr.height))
    }
  }
  return zones.left.length > 0 || zones.right.length > 0 ? zones : null
}

/** ¿Está el puntero sobre alguna zona de suelta válida? Devuelve el lado más cercano */
function hitTestSide(zones: DropZones | null, x: number, y: number, sides: Side[]): Side | null {
  if (!zones) return null
  let best: Side | null = null
  let bestDist = Infinity
  for (const side of ['left', 'right'] as const) {
    if (!sides.includes(side)) continue
    for (const r of zones[side]) {
      if (
        x < r.left - ZONE_PAD ||
        x > r.right + ZONE_PAD ||
        y < r.top - ZONE_PAD ||
        y > r.bottom + ZONE_PAD
      ) {
        continue
      }
      const dist = Math.abs(x - (r.left + r.width / 2))
      if (dist < bestDist) {
        bestDist = dist
        best = side
      }
    }
  }
  return best
}

export default function DominoPage() {
  const [state, dispatch] = useReducer(gameReducer, null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [shakeTileId, setShakeTileId] = useState<number | null>(null)
  /** la bandera del panel permanece oculta hasta que el rayo la revela en la intro */
  const [flagVisible, setFlagVisible] = useState(false)
  /** El mute vive fuera de React (módulo sfx + localStorage): sin efectos ni hidratación frágil */
  const muted = useSyncExternalStore(subscribeMuted, getMutedSnapshot, () => false)

  // ---------- Drag & drop ----------
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const zonesRef = useRef<DropZones | null>(null)
  const suppressClickRef = useRef(false)
  const rafRef = useRef(0)
  const pendingPointRef = useRef<{ x: number; y: number } | null>(null)

  const prevPhaseRef = useRef<'playing' | 'finished' | null>(null)

  const updateDrag = useCallback((d: DragState | null) => {
    dragRef.current = d
    setDrag(d)
  }, [])

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

  const playableInfo = useMemo(() => {
    const ids = new Set<number>()
    const sides = new Map<number, Side[]>()
    if (!state || state.phase !== 'playing' || state.turn !== 0) return { ids, sides }
    if (state.chain.length === 0 && state.requiredFirstTileId !== null) {
      if (state.starter === 0) {
        const t = state.hands[0].find((x) => x.id === state.requiredFirstTileId)
        if (t) {
          ids.add(t.id)
          sides.set(t.id, ['right'])
        }
      }
      return { ids, sides }
    }
    for (const t of state.hands[0]) {
      const s = sidesFor(t, state.chain)
      if (s.length > 0) {
        ids.add(t.id)
        sides.set(t.id, s)
      }
    }
    return { ids, sides }
  }, [state])
  const playableIds = playableInfo.ids

  // ---------- Paso automático: sin jugada disponible, pasas solo (como en la mesa real) ----------
  useEffect(() => {
    if (!state || state.phase !== 'playing' || state.turn !== 0) return
    if (state.chain.length === 0) return // la apertura siempre tiene la ficha obligatoria
    if (playableIds.size > 0) return
    const timer = setTimeout(() => {
      dispatch({ type: 'APPLY_PASS', player: 0 })
      playSfx('pass')
    }, AUTO_PASS_DELAY)
    return () => clearTimeout(timer)
  }, [state, playableIds])

  const autoPassing =
    myTurn && !!state && state.phase === 'playing' && state.chain.length > 0 && playableIds.size === 0

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
        ? 'Es tu turno · toca una ficha o arrástrala a la mesa'
        : 'Es tu turno · sin jugada · pasas turno automáticamente…'
    }
    return `Turno de ${SEAT_NAMES[state.turn]}…`
  }, [state, playableIds.size])

  // ---------- Acciones ----------
  const startGame = useCallback(() => {
    setShakeTileId(null)
    updateDrag(null)
    prevPhaseRef.current = 'playing'
    dispatch({ type: 'SET_GAME', state: createGame() })
    playSfx('deal')
  }, [updateDrag])

  const playTile = useCallback((tile: Tile, side: Side) => {
    setShakeTileId(null)
    dispatch({ type: 'APPLY_PLAY', player: 0, tileId: tile.id, side })
    playSfx('click')
  }, [])

  const handleTileClick = useCallback(
    (tile: Tile) => {
      // Un arrastre que termina sobre la propia ficha no cuenta como toque
      if (suppressClickRef.current) {
        suppressClickRef.current = false
        return
      }
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
        // Encaja en ambos extremos: como en la mesa real, la arrastras al lado que quieras
        toast.info('Esa ficha encaja en los dos extremos.', {
          description: 'Arrástrala hacia la mesa y suéltala en el extremo que prefieras.',
        })
      }
    },
    [state, playTile],
  )

  // ---------- Drag: listeners globales (se montan una vez, leen refs) ----------
  useEffect(() => {
    const applyMove = () => {
      rafRef.current = 0
      const point = pendingPointRef.current
      const d = dragRef.current
      if (!point || !d) return
      const active = d.active || Math.hypot(point.x - d.startX, point.y - d.startY) > DRAG_THRESHOLD
      const hover = active ? hitTestSide(zonesRef.current, point.x, point.y, d.sides) : null
      updateDrag({ ...d, x: point.x, y: point.y, active, hover })
    }
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return
      pendingPointRef.current = { x: e.clientX, y: e.clientY }
      if (!rafRef.current) rafRef.current = requestAnimationFrame(applyMove)
    }
    const onUp = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      const point = pendingPointRef.current ?? { x: e.clientX, y: e.clientY }
      const moved = d.active || Math.hypot(point.x - d.startX, point.y - d.startY) > DRAG_THRESHOLD
      if (moved) {
        // El click que pueda generarse tras un arrastre real no cuenta como toque
        suppressClickRef.current = true
        window.setTimeout(() => {
          suppressClickRef.current = false
        }, 300)
        const hover = hitTestSide(zonesRef.current, point.x, point.y, d.sides)
        if (hover) {
          playTile(d.tile, hover)
        } else {
          toast.info('Suelta la ficha sobre un extremo iluminado de la mesa.')
        }
      }
      pendingPointRef.current = null
      zonesRef.current = null
      updateDrag(null)
    }
    const onCancel = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      pendingPointRef.current = null
      zonesRef.current = null
      if (dragRef.current) updateDrag(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [playTile, updateDrag])

  const beginDrag = useCallback(
    (e: React.PointerEvent, tile: Tile, sides: Side[]) => {
      if (dragRef.current) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      zonesRef.current = collectDropZones(!!state && state.chain.length > 0)
      updateDrag({
        tile,
        sides,
        startX: e.clientX,
        startY: e.clientY,
        x: e.clientX,
        y: e.clientY,
        active: false,
        hover: null,
      })
    },
    [state, updateDrag],
  )

  const handleLeave = useCallback(() => {
    setConfirmLeave(false)
    dispatch({ type: 'RESET' })
    updateDrag(null)
    prevPhaseRef.current = null
    toast.info('Saliste de la partida.')
  }, [updateDrag])

  /** Feedback de zonas de suelta para la mesa (solo mientras se arrastra de verdad) */
  const dropHint = useMemo(() => {
    if (!drag?.active) return null
    return {
      left: drag.sides.includes('left'),
      right: drag.sides.includes('right'),
      hover: drag.hover,
    }
  }, [drag])

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
                  autoPassing && 'animate-pulse',
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
                {/* Mesa rústica de madera con panel de cristal: sobre él SOLO las fichas jugadas */}
                <div className="mesa-wood relative select-none rounded-[2rem] border-[6px] border-[#3a2412] p-3.5 sm:rounded-[2.75rem] sm:border-8 sm:p-5">
                  <CornerCups />
                  <div className="mesa-panel relative flex min-h-[400px] items-center justify-center overflow-hidden rounded-[1.5rem] p-3 sm:min-h-[440px] sm:rounded-[2rem] sm:p-4">
                    <FlagPanel visible={flagVisible || !!state} />
                    <BoardChain chain={state.chain} dropHint={dropHint} />
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
                      const tileSides = playableInfo.sides.get(tile.id)
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
                          onPointerDown={
                            myTurn && tileSides ? (e) => beginDrag(e, tile, tileSides) : undefined
                          }
                          className={cn(
                            myTurn && tileSides && 'touch-none',
                            drag?.active && drag.tile.id === tile.id && 'opacity-30',
                          )}
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
          /* Mesa vacía: intro cinematográfica (rayo + fichas) e invitación a jugar */
          <div className="mx-auto w-full max-w-3xl">
            <div className="mesa-wood relative select-none rounded-[2rem] border-[6px] border-[#3a2412] p-3.5 sm:rounded-[2.75rem] sm:border-8 sm:p-5">
              <CornerCups />
              <div className="mesa-panel relative min-h-[400px] overflow-hidden rounded-[1.5rem] sm:min-h-[440px] sm:rounded-[2rem]">
                <FlagPanel visible={flagVisible} />
                <TableIntro
                  onPhaseChange={(p) => setFlagVisible(p === 'bolt' || p === 'crack' || p === 'ready')}
                >
                  <button
                    onClick={startGame}
                    className="group flex flex-col items-center gap-1.5 rounded-2xl outline-none transition-transform duration-150 hover:-rotate-1 hover:scale-[1.04] focus-visible:ring-2 focus-visible:ring-purple-200 active:translate-y-[3px] active:scale-[0.99]"
                    aria-label="Jugar una partida de dominó"
                  >
                    <span className="relative block">
                      {/* placa estilo cómic: silueta dentada, sombra dura y borde grueso */}
                      <svg viewBox="0 0 320 124" className="w-64 sm:w-72" aria-hidden>
                        {/* sombra dura desplazada */}
                        <path
                          d={BADGE_PATH}
                          transform="translate(8 9)"
                          fill="#2e0a49"
                        />
                        {/* placa morada con contorno grueso */}
                        <path
                          d={BADGE_PATH}
                          fill="#a855f7"
                          stroke="#3b0764"
                          strokeWidth="6"
                          strokeLinejoin="round"
                        />
                        {/* muescas cómic dentro de la placa */}
                        <g
                          stroke="#3b0764"
                          strokeWidth="3"
                          strokeLinecap="round"
                          opacity="0.85"
                        >
                          <path d="M50 32 l14 -9" />
                          <path d="M266 32 l12 8" />
                          <path d="M38 78 l12 8" />
                        </g>
                      </svg>
                      <span
                        aria-hidden
                        className="absolute inset-x-0 top-0 bottom-[10px] flex items-center justify-center text-[26px] font-black uppercase tracking-[0.06em] text-[#3b0764] sm:text-[30px]"
                      >
                        Jugar
                      </span>
                    </span>
                    <span className="text-[11px] font-semibold text-purple-100/85 sm:text-xs">
                      4 jugadores · el doble más alto abre la partida
                    </span>
                  </button>
                </TableIntro>
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

      {/* Ficha fantasma que sigue al puntero mientras se arrastra hacia la mesa */}
      {drag?.active && (
        <div
          className="pointer-events-none fixed z-[70]"
          style={{
            left: drag.x,
            top: drag.y,
            transform: 'translate(-50%, -70%) rotate(-5deg) scale(1.08)',
          }}
          aria-hidden
        >
          <DominoTile
            size="lg"
            top={drag.tile.a}
            bottom={drag.tile.b}
            className="shadow-[0_18px_32px_rgba(0,0,0,0.5)]"
          />
        </div>
      )}

      {/* Diálogos */}
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
