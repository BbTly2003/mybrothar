'use client'

import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { DominoTile } from './domino-tile'
import type { PlacedTile, Side } from '@/lib/game/types'

interface BoardChainProps {
  chain: PlacedTile[]
  lastSide: Side | null
  /** número que cambia cuando se juega una ficha (para disparar el auto-scroll) */
  revision: number
}

/**
 * Cadena de fichas sobre la mesa con scroll horizontal y auto-scroll
 * hacia el extremo donde cayó la última ficha.
 */
export function BoardChain({ chain, lastSide, revision }: BoardChainProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el || chain.length === 0) return
    if (lastSide === 'left') {
      el.scrollTo({ left: 0, behavior: 'smooth' })
    } else {
      el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
    }
  }, [revision, lastSide, chain.length])

  return (
    <div
      ref={scrollRef}
      className="scrollbar-thin overflow-x-auto rounded-xl border-2 border-slate-800 bg-slate-950 shadow-inner shadow-black/60"
      role="region"
      aria-label="Cadena de fichas en la mesa"
    >
      <div
        className="flex min-h-[9.5rem] min-w-max items-center gap-2 px-5 py-4 domino-felt"
        data-testid="board-chain"
      >
        {chain.length === 0 ? (
          <span className="text-sm text-slate-500">
            Mesa vacía. La mano con el doble más alto abre la cadena.
          </span>
        ) : (
          <AnimatePresence initial={false}>
            {chain.map((tile) => (
              <motion.div
                key={tile.id}
                initial={{ opacity: 0, scale: 0.6, y: -18 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              >
                <DominoTile
                  size="md"
                  top={tile.left}
                  bottom={tile.right}
                  ariaLabel={`Ficha ${tile.left} y ${tile.right} en la mesa`}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
