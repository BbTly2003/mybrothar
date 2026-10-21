'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'
import { DominoTile } from './domino-tile'
import { SEAT_AVATAR_CLASS, SEAT_AVATARS, SEAT_NAMES } from '@/lib/game/types'

interface SeatProps {
  /** asiento 0-3 */
  seat: number
  /** fichas restantes del jugador */
  count: number
  /** turno activo: avatar con brillo */
  active: boolean
  /** oculta la pila boca abajo (asiento del jugador humano) */
  hideStack?: boolean
  className?: string
}

/**
 * Asiento estilo Plato: avatar circular de animal, nombre, pila de fichas
 * boca abajo y halo dorado cuando es su turno.
 */
export const Seat = memo(function Seat({ seat, count, active, hideStack = false, className }: SeatProps) {
  return (
    <div
      className={cn('flex flex-col items-center gap-1', className)}
      aria-label={`${SEAT_NAMES[seat]}: ${count} ficha${count === 1 ? '' : 's'}${active ? ', su turno' : ''}`}
    >
      <div className="relative">
        {active && <span className="absolute -inset-1.5 rounded-full bg-amber-300/25 blur-[3px]" aria-hidden />}
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-b text-lg shadow-lg ring-2 ring-black/25 sm:h-13 sm:w-13 sm:text-xl',
            SEAT_AVATAR_CLASS[seat],
            active && 'ring-amber-300',
          )}
          aria-hidden
        >
          <span className="drop-shadow-sm">{SEAT_AVATARS[seat]}</span>
        </div>
        <span
          className={cn(
            'absolute -bottom-1.5 -right-1.5 rounded-full border border-black/30 px-1.5 text-center text-[10px] font-black leading-4',
            active ? 'bg-amber-400 text-zinc-950' : 'bg-zinc-800 text-white',
          )}
          aria-hidden
        >
          {count}
        </span>
      </div>
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm sm:text-[11px]',
          active ? 'bg-amber-400 text-zinc-950' : 'bg-black/45 text-white/85',
        )}
        aria-hidden
      >
        {SEAT_NAMES[seat]}
      </span>
      {!hideStack && (
        <div className="flex -space-x-2.5 pt-0.5" aria-hidden>
          {Array.from({ length: Math.min(count, 7) }).map((_, i) => (
            <DominoTile
              key={i}
              size="sm"
              orientation="vertical"
              faceDown
              className="h-7 w-3.5 rounded-[4px]"
            />
          ))}
        </div>
      )}
    </div>
  )
})
