'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'

/** Posiciones de los puntos en una cuadrícula 3×3 para cada valor 0-6 (ficha vertical) */
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
  horizontal?: boolean
}

function Pips({ value, dot, horizontal = false }: PipsProps) {
  // En horizontal la mitad gira 90°: la cuadrícula de puntos se rota con ella.
  const positions = horizontal
    ? (PIP_POSITIONS[value] ?? []).map(([r, c]) => [c, 2 - r] as [number, number])
    : (PIP_POSITIONS[value] ?? [])

  return (
    <div className="grid h-full w-full grid-cols-3 grid-rows-3 place-items-center p-[2px]" aria-hidden>
      {Array.from({ length: 9 }).map((_, index) => {
        const row = Math.floor(index / 3)
        const col = index % 3
        const on = positions.some(([r, c]) => r === row && c === col)
        return (
          <span
            key={index}
            className={cn(
              'rounded-full',
              on ? cn('bg-zinc-800 shadow-[inset_0_-1px_1px_rgba(0,0,0,0.55)]', dot) : 'bg-transparent',
            )}
          />
        )
      })}
    </div>
  )
}

const TILE_SIZES = {
  sm: {
    vertical: 'h-16 w-8 rounded-[7px]',
    horizontal: 'h-8 w-16 rounded-[7px]',
    dot: 'h-1 w-1',
  },
  md: {
    vertical: 'h-20 w-10 rounded-lg sm:h-22 sm:w-11',
    horizontal: 'h-10 w-20 rounded-lg sm:h-11 sm:w-22',
    dot: 'h-[5px] w-[5px]',
  },
  lg: {
    vertical: 'h-24 w-12 rounded-lg sm:h-28 sm:w-14',
    horizontal: 'h-12 w-24 rounded-lg sm:h-28 sm:w-14',
    dot: 'h-1.5 w-1.5',
  },
} as const

export interface DominoTileProps {
  /** vertical: superior/inferior · horizontal: izquierdo/derecho */
  top: number
  bottom: number
  size?: keyof typeof TILE_SIZES
  orientation?: 'vertical' | 'horizontal'
  faceDown?: boolean
  playable?: boolean
  disabled?: boolean
  highlight?: boolean
  onClick?: () => void
  className?: string
  ariaLabel?: string
}

/**
 * Ficha de dominó estilo Plato: blanca, esquinas redondeadas y puntos limpios.
 * En horizontal (sobre la mesa) las mitades van lado a lado; el doble se coloca en cruz.
 */
export const DominoTile = memo(function DominoTile({
  top,
  bottom,
  size = 'md',
  orientation = 'vertical',
  faceDown = false,
  playable = false,
  disabled = false,
  highlight = false,
  onClick,
  className,
  ariaLabel,
}: DominoTileProps) {
  const sizeConfig = TILE_SIZES[size]
  const box = orientation === 'vertical' ? sizeConfig.vertical : sizeConfig.horizontal
  const dot = sizeConfig.dot

  const interactive = playable && !disabled && !!onClick && !faceDown

  return (
    <button
      type="button"
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      aria-label={ariaLabel}
      className={cn(
        'relative flex shrink-0 select-none items-center justify-center border border-black/15 p-0 transition-all duration-150',
        box,
        faceDown
          ? 'bg-gradient-to-b from-stone-100 to-stone-300 shadow-[0_2px_5px_rgba(0,0,0,0.35)]'
          : 'bg-gradient-to-b from-white via-white to-stone-200 text-zinc-800 shadow-[0_2px_5px_rgba(0,0,0,0.35),0_10px_18px_rgba(0,0,0,0.18)]',
        interactive &&
          'cursor-pointer hover:-translate-y-1.5 hover:shadow-[0_0_0_2px_rgba(52,211,153,0.95),0_10px_18px_rgba(0,0,0,0.25)] focus-visible:shadow-[0_0_0_2px_rgba(52,211,153,0.95)] focus-visible:outline-none',
        !interactive && 'cursor-default',
        disabled && !faceDown && 'opacity-60 saturate-[0.7]',
        highlight && 'shadow-[0_0_0_3px_#fbbf24,0_2px_5px_rgba(0,0,0,0.35)]',
        className,
      )}
    >
      {faceDown ? (
        <span
          className="m-auto h-1/2 w-1/2 rounded-full border-2 border-emerald-900/25 bg-emerald-700/10"
          aria-hidden
        />
      ) : orientation === 'horizontal' ? (
        <>
          <div className="h-full w-[42%]">
            <Pips value={top} dot={dot} horizontal />
          </div>
          <div className="h-[72%] w-px shrink-0 bg-zinc-300" aria-hidden />
          <div className="h-full w-[42%]">
            <Pips value={bottom} dot={dot} horizontal />
          </div>
        </>
      ) : (
        <>
          <div className="h-[42%] w-full">
            <Pips value={top} dot={dot} />
          </div>
          <div className="h-px w-[72%] shrink-0 bg-zinc-300" aria-hidden />
          <div className="h-[42%] w-full">
            <Pips value={bottom} dot={dot} />
          </div>
        </>
      )}
    </button>
  )
})
