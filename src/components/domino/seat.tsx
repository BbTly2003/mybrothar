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
  /** turno activo: cápsula iluminada en ámbar */
  active: boolean
  /** oculta la pila boca abajo (asiento del jugador humano: sus fichas reales van al lado) */
  hideStack?: boolean
  className?: string
}

/**
 * Perfil de jugador estilo Plato, FUERA de la mesa: cápsula de cristal con el
 * avatar circular, el nombre y la pila de fichas de su mano (boca abajo para
 * los bots, como sujetándolas frente a ellos). El jugador humano no lleva
 * pila: sus fichas reales se muestran boca arriba junto a su cápsula.
 */
export const Seat = memo(function Seat({
  seat,
  count,
  active,
  hideStack = false,
  className,
}: SeatProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-2.5 shadow-lg backdrop-blur-sm transition-colors duration-200',
        active
          ? 'border-amber-300/70 bg-amber-400/15 shadow-[0_0_20px_rgba(251,191,36,0.3)]'
          : 'border-white/10 bg-zinc-900/60',
        className,
      )}
      aria-label={`${SEAT_NAMES[seat]}: ${count} ficha${count === 1 ? '' : 's'} en mano${active ? ', su turno' : ''}`}
    >
      <div className="relative">
        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b text-xl shadow-md ring-2 ring-black/25 sm:h-13 sm:w-13 sm:text-2xl',
            SEAT_AVATAR_CLASS[seat],
          )}
          aria-hidden
        >
          <span className="drop-shadow-sm">{SEAT_AVATARS[seat]}</span>
        </div>
        <span
          className={cn(
            'absolute -bottom-1.5 -right-2 rounded-full border border-black/30 px-1.5 text-center text-[10px] font-black leading-4',
            active ? 'bg-amber-400 text-zinc-950' : 'bg-zinc-800 text-white',
          )}
          aria-hidden
        >
          {count}
        </span>
      </div>
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-[10px] font-bold sm:text-[11px]',
          active ? 'bg-amber-400 text-zinc-950' : 'bg-black/50 text-white/85',
        )}
        aria-hidden
      >
        {SEAT_NAMES[seat]}
      </span>
      {!hideStack && (
        <div className="flex -space-x-2 pt-0.5" aria-hidden>
          {Array.from({ length: Math.min(count, 7) }).map((_, i) => (
            <DominoTile
              key={i}
              size="sm"
              orientation="vertical"
              faceDown
              className="h-8 w-4 rounded-[5px]"
            />
          ))}
        </div>
      )}
    </div>
  )
})
