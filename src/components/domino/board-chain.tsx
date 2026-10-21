'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { DominoTile } from './domino-tile'
import type { PlacedTile, Side } from '@/lib/game/types'

interface BoardChainProps {
  chain: PlacedTile[]
  lastSide: Side | null
  /** número que cambia cuando se juega una ficha (para disparar el auto-scroll) */
  revision: number
}

/**
 * Cadena de fichas sobre el fieltro verde: fichas tumbadas en horizontal y
 * los dobles colocados en cruz. Se centra en la mesa cuando cabe y hace
 * scroll hacia el extremo de la última jugada cuando desborda.
 */
export function BoardChain({ chain, lastSide, revision }: BoardChainProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [centered, setCentered] = useState(true)

  // Centrada mientras la cadena quepa en el ancho disponible; al desbordar, scroll normal
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => setCentered(el.scrollWidth <= el.clientWidth + 1)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [chain.length])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || chain.length === 0 || centered) return
    if (lastSide === 'left') {
      el.scrollTo({ left: 0, behavior: 'smooth' })
    } else {
      el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
    }
  }, [revision, lastSide, chain.length, centered])

  return (
    <div
      ref={scrollRef}
      className="scrollbar-thin overflow-x-auto overflow-y-hidden"
      role="region"
      aria-label="Cadena de fichas en la mesa"
    >
      <div
        className={cn(
          'flex min-h-[6.25rem] items-center gap-1.5 px-3 py-2 sm:gap-2 sm:px-4',
          chain.length > 0 && 'min-w-max',
          centered ? 'w-full justify-center' : 'justify-start',
        )}
        data-testid="board-chain"
      >
        {chain.length === 0 ? (
          <div className="flex h-16 max-w-full items-center justify-center rounded-xl border-2 border-dashed border-white/25 px-4 text-center sm:px-6">
            <span className="text-xs font-semibold text-white/60 sm:text-sm">
              Mesa vacía · el doble más alto abre la cadena
            </span>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {chain.map((tile) => {
              const isDouble = tile.left === tile.right
              return (
                <motion.div
                  key={tile.id}
                  initial={{ opacity: 0, scale: 0.5, y: -26 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 480, damping: 26 }}
                >
                  <DominoTile
                    size="md"
                    orientation={isDouble ? 'vertical' : 'horizontal'}
                    top={tile.left}
                    bottom={tile.right}
                    ariaLabel={`Ficha ${tile.left} y ${tile.right} en la mesa`}
                  />
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

