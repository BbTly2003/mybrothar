'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { DominoTile } from './domino-tile'
import type { PlacedTile } from '@/lib/game/types'

interface BoardChainProps {
  chain: PlacedTile[]
}

/** Métricas por nivel: ficha horizontal (ancho), doble en cruz (ancho), alto de fila, separación */
const TIERS = [
  { size: 'md', tileW: 88, dblW: 44, rowH: 92, gap: 8 },
  { size: 'sm', tileW: 64, dblW: 32, rowH: 68, gap: 6 },
  { size: 'xs', tileW: 50, dblW: 25, rowH: 54, gap: 5 },
] as const

const PAD_X = 12
/**
 * Presupuesto de alto de la cadena. El fieltro ya es territorio exclusivo de
 * las fichas jugadas (perfiles y manos viven fuera de la mesa), así que la
 * serpentina puede respirar: si una fila extra hace falta, la mesa crece.
 */
const BUDGET_DESKTOP = 390
const BUDGET_MOBILE = 330
const ROW_GAP = 4

interface Layout {
  rows: PlacedTile[][]
  tier: (typeof TIERS)[number]
  fits: boolean
}

/**
 * Reparte la cadena en filas serpenteantes (izq→der, luego der→izq, …) para que
 * todas las fichas queden organizadas sobre la mesa sin recortes ni scroll.
 * Elige el nivel de tamaño más grande cuya pila de filas quepa en el presupuesto.
 */
function computeLayout(chain: PlacedTile[], width: number, budget: number): Layout | null {
  if (width <= 0) return null
  let fallback: Layout | null = null
  for (const tier of TIERS) {
    const maxW = Math.max(width - PAD_X * 2, tier.tileW)
    const rows: PlacedTile[][] = [[]]
    let rowWidth = 0
    for (const tile of chain) {
      const tileW = tile.left === tile.right ? tier.dblW : tier.tileW
      const row = rows[rows.length - 1]
      const needed = row.length === 0 ? tileW : rowWidth + tier.gap + tileW
      if (needed > maxW && row.length > 0) {
        rows.push([tile])
        rowWidth = tileW
      } else {
        row.push(tile)
        rowWidth = needed
      }
    }
    const height = rows.length * tier.rowH + (rows.length - 1) * ROW_GAP
    const layout: Layout = { rows, tier, fits: height <= budget }
    // Si ningún nivel cabe del todo, se queda el más pequeño (la mesa crece)
    fallback = layout
    if (layout.fits) return layout
  }
  return fallback
}

/**
 * Cadena de fichas estilo Plato: lo ÚNICO que vive sobre el fieltro. Se organiza
 * sola en una serpentina centrada de filas alternadas; los dobles van en cruz y
 * los dos extremos abiertos llevan un aro esmeralda (ahí es donde se puede jugar).
 * En las filas que van de derecha a izquierda las mitades se muestran
 * intercambiadas para que los puntos que se tocan sigan coincidiendo.
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

  const layout = useMemo(() => computeLayout(chain, width, budget), [chain, width, budget])

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
        <div className="flex flex-col items-center px-1 py-1" style={{ gap: ROW_GAP }}>
          {layout.rows.map((row, rowIndex) => {
            const reversed = rowIndex % 2 === 1
            return (
              <div
                key={rowIndex}
                className={cn('flex items-center justify-center', reversed && 'flex-row-reverse')}
                style={{ minHeight: layout.tier.rowH, gap: layout.tier.gap }}
                data-testid={`chain-row-${rowIndex}`}
              >
                {row.map((tile) => {
                  const isDouble = tile.left === tile.right
                  // En filas en dirección derecha→izquierda se intercambian las
                  // mitades para que el extremo que conecta quede del lado correcto.
                  const showTop = reversed && !isDouble ? tile.right : tile.left
                  const showBottom = reversed && !isDouble ? tile.left : tile.right
                  const isNew = freshIds.has(tile.id)
                  return (
                    <motion.div
                      key={tile.id}
                      initial={isNew ? { opacity: 0, scale: 0.5, y: -26 } : false}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 480, damping: 26 }}
                    >
                      <DominoTile
                        size={layout.tier.size}
                        orientation={isDouble ? 'vertical' : 'horizontal'}
                        top={showTop}
                        bottom={showBottom}
                        glow={endIds.has(tile.id)}
                        ariaLabel={`Ficha ${tile.left} y ${tile.right} en la mesa`}
                      />
                    </motion.div>
                  )
                })}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
