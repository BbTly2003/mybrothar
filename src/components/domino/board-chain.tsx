'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { DominoTile } from './domino-tile'
import type { PlacedTile } from '@/lib/game/types'

interface BoardChainProps {
  chain: PlacedTile[]
}

/** Métricas por nivel: tL = lado largo de la ficha (tS = lado corto = tL/2) */
const TIERS = [
  { size: 'md', tL: 88 },
  { size: 'sm', tL: 64 },
  { size: 'xs', tL: 50 },
] as const

/** Margen interior para que el aro de los extremos no se recorte */
const PAD = 10
/** Presupuesto de alto de la serpiente (el fieltro crece si hace falta) */
const BUDGET_DESKTOP = 390
const BUDGET_MOBILE = 330

interface Box {
  tile: PlacedTile
  x: number
  y: number
  w: number
  h: number
  /** true = ficha en vertical (dobles en cruz, esquinas y tramos de giro) */
  vertical: boolean
  /** true = mitad izquierda/right intercambiadas (filas que corren hacia la izquierda) */
  swap: boolean
}

interface SnakeLayout {
  boxes: Box[]
  tier: (typeof TIERS)[number]
  width: number
  height: number
  fits: boolean
}

/**
 * Serpiente auténtica de dominó (como en las fotos de partidas reales):
 * - fichas tumbadas toca-toca, extremo con extremo, sin huecos;
 * - los dobles van EN CRUZ (perpendiculares a la línea);
 * - cuando una fila se llena, la ficha del giro se coloca PERPENDICULAR
 *   colgando bajo el extremo de la fila (como el giro en L de una mesa real)
 *   y la siguiente fila regresa en dirección contraria pegada a esa esquina;
 * - los puntos que se tocan quedan alineados en cada costura y en cada giro.
 */
function computeSnake(chain: PlacedTile[], W: number, budget: number): SnakeLayout | null {
  if (W <= 0) return null
  let fallback: SnakeLayout | null = null
  for (const tier of TIERS) {
    const tL = tier.tL
    const tS = tL / 2
    const boxes: Box[] = []
    let i = 0
    let dir = 1 // 1 = hacia la derecha · -1 = hacia la izquierda
    let cursor = PAD // para dir=1: borde izquierdo de la próxima ficha; para dir=-1: borde derecho
    let yRow = 0 // línea central de la fila actual

    while (i < chain.length) {
      // --- tramo horizontal: coloca fichas mientras quepan ---
      let placed = 0
      let lastWasDouble = false
      while (i < chain.length) {
        const tile = chain[i]
        const isDouble = tile.left === tile.right
        const along = isDouble ? tS : tL
        const remaining = dir === 1 ? W - PAD - cursor : cursor - PAD
        if (placed > 0 && along > remaining) break // no cabe: aquí va la esquina
        let x: number
        if (dir === 1) {
          x = cursor
          cursor += along
        } else {
          cursor -= along
          x = cursor
        }
        boxes.push(
          isDouble
            ? { tile, x, y: yRow - tL / 2, w: tS, h: tL, vertical: true, swap: false }
            : {
                tile,
                x,
                y: yRow - tS / 2,
                w: tL,
                h: tS,
                vertical: false,
                swap: dir === -1,
              },
        )
        placed++
        lastWasDouble = isDouble
        i++
      }
      // --- esquina perpendicular (conecta esta fila con la siguiente) ---
      if (i < chain.length) {
        const tile = chain[i]
        i++
        // Cuelga bajo el extremo de la fila, alineada con su borde de salida.
        // Si la ficha anterior era un doble en cruz, cuelga desde su borde.
        const cornerTop = yRow + (lastWasDouble ? tL / 2 : tS / 2)
        const cx = dir === 1 ? cursor - tS : cursor
        boxes.push({
          tile,
          x: cx,
          y: cornerTop,
          w: tS,
          h: tL,
          vertical: true,
          swap: false,
        })
        // La fila siguiente nace pegada al pie de la esquina; si su primera
        // ficha es un doble en cruz necesita medio lado corto más de aire.
        const cornerBottom = cornerTop + tL
        const nextIsDouble = chain[i] !== undefined && chain[i].left === chain[i].right
        yRow = cornerBottom + (nextIsDouble ? tS : tS / 2)
        dir = -dir
        // la próxima fila arranca alineada con la esquina
        cursor = dir === 1 ? cx : cx + tS
      }
    }

    // --- normalizar: recorte del bounding box + centrado horizontal ---
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const b of boxes) {
      minX = Math.min(minX, b.x)
      maxX = Math.max(maxX, b.x + b.w)
      minY = Math.min(minY, b.y)
      maxY = Math.max(maxY, b.y + b.h)
    }
    const dx = Math.max(PAD, (W - (maxX - minX)) / 2) - minX
    for (const b of boxes) {
      b.x += dx
      b.y -= minY
    }
    const height = maxY - minY
    const layout: SnakeLayout = { boxes, tier, width: W, height, fits: height <= budget }
    // Si ningún nivel cabe del todo, se queda el más pequeño (la mesa crece)
    fallback = layout
    if (layout.fits) return layout
  }
  return fallback
}

/**
 * La cadena de fichas es lo ÚNICO que vive sobre el fieltro: serpiente continua
 * y organizada como en una mesa real, con dobles en cruz, esquinas perpendiculares
 * y aro esmeralda en los dos extremos abiertos (ahí es donde se puede jugar).
 */
export function BoardChain({ chain }: BoardChainProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  // Fichas ya vistas y fichas recién jugadas (patrón de ajuste de estado en render:
  // se recalculan solo cuando cambia la referencia de la cadena)
  const [seenIds, setSeenIds] = useState<Set<number>>(() => new Set())
  const [freshIds, setFreshIds] = useState<Set<number>>(() => new Set())
  const [lastChain, setLastChain] = useState<PlacedTile[]>(chain)
  const [budget, setBudget] = useState(BUDGET_DESKTOP)

  // Presupuesto de alto según el ancho de pantalla
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    const update = () => setBudget(mq.matches ? BUDGET_DESKTOP : BUDGET_MOBILE)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  if (chain !== lastChain) {
    setLastChain(chain)
    if (chain.length === 0) {
      // Partida nueva: olvidar todo para que la apertura vuelva a animarse
      if (seenIds.size > 0) setSeenIds(new Set())
      if (freshIds.size > 0) setFreshIds(new Set())
    } else {
      const fresh = new Set<number>()
      for (const tile of chain) if (!seenIds.has(tile.id)) fresh.add(tile.id)
      if (fresh.size > 0) {
        const nextSeen = new Set(seenIds)
        for (const id of fresh) nextSeen.add(id)
        setSeenIds(nextSeen)
        setFreshIds(fresh)
      } else if (freshIds.size > 0) {
        setFreshIds(new Set())
      }
    }
  }

  // Ancho disponible medido en vivo (define cuántas fichas caben por fila)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const layout = useMemo(() => computeSnake(chain, width, budget), [chain, width, budget])

  // Extremos abiertos de la cadena: primera y última ficha jugadas
  const endIds = useMemo(() => {
    const ids = new Set<number>()
    if (chain.length > 0) {
      ids.add(chain[0].id)
      ids.add(chain[chain.length - 1].id)
    }
    return ids
  }, [chain])

  return (
    <div ref={wrapRef} className="w-full" role="region" aria-label="Cadena de fichas en la mesa">
      {chain.length === 0 ? (
        <div className="flex min-h-24 items-center justify-center px-3">
          <div className="flex max-w-full items-center justify-center rounded-xl border-2 border-dashed border-white/25 px-4 py-3 text-center sm:px-6">
            <span className="text-xs font-semibold text-white/60 sm:text-sm">
              Mesa vacía · el doble más alto abre la cadena
            </span>
          </div>
        </div>
      ) : layout ? (
        <div className="relative w-full" style={{ height: layout.height }}>
          {layout.boxes.map((box, index) => {
            const isNew = freshIds.has(box.tile.id)
            return (
              <motion.div
                key={box.tile.id}
                data-testid={`snake-${index}`}
                className="absolute"
                style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
                initial={isNew ? { opacity: 0, scale: 0.5 } : false}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 480, damping: 26 }}
              >
                <DominoTile
                  size={layout.tier.size}
                  orientation={box.vertical ? 'vertical' : 'horizontal'}
                  top={box.swap ? box.tile.right : box.tile.left}
                  bottom={box.swap ? box.tile.left : box.tile.right}
                  glow={endIds.has(box.tile.id)}
                  style={{ width: '100%', height: '100%' }}
                  ariaLabel={`Ficha ${box.tile.left} y ${box.tile.right} en la mesa`}
                />
              </motion.div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
