'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'

/** Posiciones de los puntos en una cuadrícula 3×3 para cada valor 0-6 */
const PIP_POSITIONS: Record<number, Array<[number, number]>> = {
  0: [],
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [0, 2],
    [2, 0],
    [2, 2],
  ],
  5: [
    [0, 0],
    [0, 2],
    [1, 1],
    [2, 0],
    [2, 2],
  ],
  6: [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 2],
    [1, 2],
    [2, 2],
  ],
}

interface PipsProps {
  value: number
  dot: string
}

function Pips({ value, dot }: PipsProps) {
  return (
    <div className="grid h-full w-full grid-cols-3 grid-rows-3 place-items-center p-[3px]" aria-hidden>
      {Array.from({ length: 9 }).map((_, index) => {
        const row = Math.floor(index / 3)
        const col = index % 3
        const on = PIP_POSITIONS[value]?.some(([r, c]) => r === row && c === col)
        return <span key={index} className={cn('rounded-full', on ? dot : 'bg-transparent')} />
      })}
    </div>
  )
}

const SIZE_CLASSES = {
  sm: 'w-9 h-[4.5rem] rounded-md',
  md: 'w-10 h-20 rounded-lg sm:w-11 sm:h-[5.5rem]',
  lg: 'w-12 h-24 rounded-lg sm:w-14 sm:h-28',
} as const

const DOT_CLASSES = {
  sm: 'w-[5px] h-[5px] bg-slate-900',
  md: 'w-[6px] h-[6px] bg-slate-900',
  lg: 'w-[7px] h-[7px] bg-slate-900',
} as const

export interface DominoTileProps {
  /** valores superior e inferior a mostrar */
  top: number
  bottom: number
  size?: keyof typeof SIZE_CLASSES
  faceDown?: boolean
  playable?: boolean
  disabled?: boolean
  highlight?: boolean
  onClick?: () => void
  className?: string
  ariaLabel?: string
}

/**
 * Ficha de dominó vertical con puntos reales.
 * `playable` activa hover y anillo esmeralda; `disabled` atenúa la ficha.
 */
export const DominoTile = memo(function DominoTile({
  top,
  bottom,
  size = 'md',
  faceDown = false,
  playable = false,
  disabled = false,
  highlight = false,
  onClick,
  className,
  ariaLabel,
}: DominoTileProps) {
  const dot = DOT_CLASSES[size]

  const interactive = playable && !disabled && !!onClick

  return (
    <button
      type="button"
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      aria-label={ariaLabel}
      className={cn(
        'relative flex shrink-0 select-none flex-col items-center justify-between border-2 p-1 shadow-md transition-all duration-150',
        SIZE_CLASSES[size],
        faceDown
          ? 'border-emerald-950 bg-gradient-to-b from-emerald-700 to-emerald-900 shadow-emerald-950/50'
          : 'border-slate-950 bg-gradient-to-b from-slate-50 to-slate-300 text-slate-950 shadow-black/40',
        interactive &&
          'cursor-pointer hover:-translate-y-1.5 hover:shadow-lg hover:ring-2 hover:ring-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none',
        !interactive && 'cursor-default',
        disabled && !faceDown && 'opacity-55 saturate-50',
        highlight && 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-950',
        className,
      )}
    >
      {faceDown ? (
        <>
          <span className="absolute inset-1 rounded-[4px] border border-emerald-950/60" aria-hidden />
          <span className="m-auto h-2 w-2 rounded-full bg-emerald-950/70 shadow-inner" aria-hidden />
        </>
      ) : (
        <>
          <div className="h-[42%] w-full">
            <Pips value={top} dot={dot} />
          </div>
          <div className="h-[2px] w-[80%] rounded-full bg-slate-800/80" aria-hidden />
          <div className="h-[42%] w-full">
            <Pips value={bottom} dot={dot} />
          </div>
        </>
      )}
    </button>
  )
})
