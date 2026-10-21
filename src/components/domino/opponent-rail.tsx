'use client'

import { cn } from '@/lib/utils'
import { DominoTile } from './domino-tile'
import { SEAT_NAMES } from '@/lib/game/types'

interface OpponentRailProps {
  /** fichas restantes de cada bot: índices 1-3 */
  counts: [number, number, number]
  activeSeat: number | null
}

/** Rail superior con los 3 bots: fichas boca abajo restantes y turno activo */
export function OpponentRail({ counts, activeSeat }: OpponentRailProps) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3" role="list" aria-label="Oponentes">
      {counts.map((count, index) => {
        const seat = index + 1
        const active = activeSeat === seat
        return (
          <div
            key={seat}
            role="listitem"
            aria-label={`${SEAT_NAMES[seat]}, ${count} fichas`}
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl border bg-slate-900/80 px-2 py-2 transition-colors sm:gap-3 sm:px-3',
              active ? 'border-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.35)]' : 'border-slate-800',
            )}
          >
            <div className="hidden sm:flex" aria-hidden>
              {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
                <DominoTile
                  key={i}
                  size="sm"
                  faceDown
                  className={cn('h-12 w-6 rounded-md p-0.5', i > 0 && '-ml-4')}
                />
              ))}
            </div>
            <div className="min-w-0 text-left">
              <p className="truncate text-xs font-semibold text-slate-200 sm:text-sm">
                {SEAT_NAMES[seat]}
              </p>
              <p className={cn('text-[11px] sm:text-xs', active ? 'text-emerald-400' : 'text-slate-500')}>
                {active ? 'pensando…' : `${count} ficha${count === 1 ? '' : 's'}`}
              </p>
            </div>
            <span
              className="ml-auto rounded-md bg-slate-800 px-2 py-0.5 text-xs font-bold text-emerald-300 sm:hidden"
              aria-hidden
            >
              {count}
            </span>
          </div>
        )
      })}
    </div>
  )
}
