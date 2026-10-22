'use client'

import { memo, type CSSProperties } from 'react'
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

/**
 * Aspecto de ficha física real de marfil (como las fichas clásicas de mesa):
 * cuerpo marfil cálido con brillo suave, puntos azul muy oscuro tipo taladro,
 * línea divisoria grabada con clavo (spinner) central.
 */
const PIP = 'bg-[#1f2434]'

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
    <div className="grid h-full w-full grid-cols-3 grid-rows-3 place-items-center" aria-hidden>
      {Array.from({ length: 9 }).map((_, index) => {
        const row = Math.floor(index / 3)
        const col = index % 3
        const on = positions.some(([r, c]) => r === row && c === col)
        return (
          <span
            key={index}
            className={cn(
              'rounded-full',
              on
                ? cn(
                    // punto hundido: sombra interior arriba + brillo abajo
                    PIP,
                    'shadow-[inset_0_1px_1px_rgba(0,0,0,0.65),inset_0_-0.5px_0.5px_rgba(255,255,255,0.22)]',
                    dot,
                  )
                : 'bg-transparent',
            )}
          />
        )
      })}
    </div>
  )
}

/**
 * Línea divisoria grabada con el clavo central (spinner) de las fichas reales.
 * La ranura oscura lleva un brillo claro justo debajo/derecha, como la luz
 * que rebota en el grabado físico.
 */
function Divider({ spinner, horizontal = false }: { spinner: string; horizontal?: boolean }) {
  return (
    <span
      className={cn(
        'relative shrink-0 self-center',
        horizontal ? 'h-[84%] w-[2px]' : 'h-[2px] w-[84%]',
      )}
      aria-hidden
    >
      <span className="absolute inset-0 rounded-full bg-[#2b3040]/85 shadow-[1px_1px_0_rgba(255,255,255,0.55)]" />
      <span
        className={cn(
          'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full',
          PIP,
          'shadow-[inset_0_0.5px_0.5px_rgba(0,0,0,0.6)]',
          spinner,
        )}
      />
    </span>
  )
}

const TILE_SIZES = {
  xs: {
    vertical: 'h-[50px] w-[25px] rounded-[5px]',
    horizontal: 'h-[25px] w-[50px] rounded-[5px]',
    dot: 'h-[3px] w-[3px]',
    spinner: 'h-[3px] w-[3px]',
  },
  sm: {
    vertical: 'h-16 w-8 rounded-[7px]',
    horizontal: 'h-8 w-16 rounded-[7px]',
    dot: 'h-1 w-1',
    spinner: 'h-1 w-1',
  },
  md: {
    vertical: 'h-20 w-10 rounded-lg sm:h-22 sm:w-11',
    horizontal: 'h-10 w-20 rounded-lg sm:h-11 sm:w-22',
    dot: 'h-[5px] w-[5px]',
    spinner: 'h-[5px] w-[5px]',
  },
  lg: {
    vertical: 'h-24 w-12 rounded-lg sm:h-28 sm:w-14',
    horizontal: 'h-12 w-24 rounded-lg sm:h-14 sm:w-28',
    dot: 'h-1.5 w-1.5',
    spinner: 'h-1.5 w-1.5',
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
  /** aro esmeralda suave: marca los extremos abiertos de la cadena en la mesa */
  glow?: boolean
  onClick?: () => void
  className?: string
  /** estilo inline (la serpiente de la mesa fuerza el tamaño exacto en px) */
  style?: CSSProperties
  ariaLabel?: string
}

/** Cuerpo marfil cálido con borde de hueso envejecido */
const BODY = 'border-[#b7a986]/70 bg-[linear-gradient(160deg,#f8f2e1_0%,#f2ead4_45%,#e3d8bb_100%)]'
/** Reverso de la ficha (misma pasta de marfil, algo más apagada) */
const BODY_BACK = 'border-[#ac9d7c]/70 bg-[linear-gradient(160deg,#f0e9d5_0%,#e7ddc3_55%,#d4c7a5_100%)]'

/**
 * Ficha de dominó con aspecto de ficha física real de marfil: cuerpo crema
 * cálido, puntos azul noche, divisoria grabada con clavo central, esquinas
 * redondeadas y bisel suave que le da grosor sobre la mesa.
 * Vertical = mitades apiladas (flex-col) · Horizontal = mitades lado a lado (flex-row).
 * El doble se coloca en cruz (vertical sobre la cadena).
 *
 * NOTA: todas las clases shadow-[...] deben ser literales completos — Tailwind
 * no puede generar clases construidas con variables/template literals.
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
  glow = false,
  onClick,
  className,
  style,
  ariaLabel,
}: DominoTileProps) {
  const sizeConfig = TILE_SIZES[size]
  const box = orientation === 'vertical' ? sizeConfig.vertical : sizeConfig.horizontal
  const dot = sizeConfig.dot
  const spinner = sizeConfig.spinner

  const interactive = playable && !disabled && !!onClick && !faceDown

  return (
    <button
      type="button"
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      aria-label={ariaLabel}
      style={style}
      className={cn(
        'relative flex shrink-0 select-none items-center justify-center border p-0 transition-all duration-150',
        box,
        faceDown
          ? 'border-[#ac9d7c]/70 bg-[linear-gradient(160deg,#f0e9d5_0%,#e7ddc3_55%,#d4c7a5_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),inset_1px_0_1px_rgba(255,255,255,0.3),inset_0_-2px_3px_rgba(146,124,84,0.25),0_2px_4px_rgba(58,36,14,0.4)]'
          : 'border-[#b7a986]/70 bg-[linear-gradient(160deg,#f8f2e1_0%,#f2ead4_45%,#e3d8bb_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),inset_1px_0_1px_rgba(255,255,255,0.35),inset_0_-2px_3px_rgba(146,124,84,0.25),0_3px_5px_rgba(58,36,14,0.35),0_9px_16px_rgba(58,36,14,0.22)]',
        // Jugable: SIEMPRE levantada (más que las demás) para que se vea de un vistazo
        // qué fichas puedes jugar — como en la mesa real, sin ayuda de nadie.
        interactive &&
          'cursor-grab -translate-y-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),inset_1px_0_1px_rgba(255,255,255,0.35),inset_0_-2px_3px_rgba(146,124,84,0.25),0_0_0_2px_rgba(16,185,129,0.8),0_10px_20px_rgba(16,185,129,0.25),0_6px_12px_rgba(58,36,14,0.32)] hover:-translate-y-4 hover:cursor-grabbing hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.85),inset_1px_0_1px_rgba(255,255,255,0.35),inset_0_-2px_3px_rgba(146,124,84,0.25),0_0_0_2px_rgba(52,211,153,0.95),0_16px_26px_rgba(16,185,129,0.35),0_10px_18px_rgba(58,36,14,0.3)] focus-visible:outline-none focus-visible:shadow-[inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-2px_3px_rgba(146,124,84,0.25),0_0_0_2px_rgba(52,211,153,0.95)]',
        !interactive && 'cursor-default',
        disabled && !faceDown && 'brightness-[0.95]',
        highlight &&
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-2px_3px_rgba(146,124,84,0.25),0_0_0_3px_#fbbf24,0_3px_6px_rgba(58,36,14,0.35)]',
        glow &&
          !highlight &&
          !interactive &&
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-2px_3px_rgba(146,124,84,0.25),0_0_0_2px_rgba(52,211,153,0.9),0_4px_12px_rgba(16,185,129,0.45)]',
        className,
      )}
    >
      {faceDown ? (
        <span
          className="h-2 w-2 shrink-0 rounded-full bg-emerald-700/70 shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]"
          aria-hidden
        />
      ) : orientation === 'vertical' ? (
        // Mitades apiladas: arriba | línea divisoria | abajo
        <span className="flex h-full w-full flex-col items-stretch">
          <span className="min-h-0 w-full flex-1">
            <Pips value={top} dot={dot} />
          </span>
          <Divider spinner={spinner} />
          <span className="min-h-0 w-full flex-1">
            <Pips value={bottom} dot={dot} />
          </span>
        </span>
      ) : (
        // Mitades lado a lado: izquierda | línea divisoria | derecha
        <span className="flex h-full w-full flex-row items-stretch">
          <span className="h-full min-w-0 flex-1">
            <Pips value={top} dot={dot} horizontal />
          </span>
          <Divider spinner={spinner} horizontal />
          <span className="h-full min-w-0 flex-1">
            <Pips value={bottom} dot={dot} horizontal />
          </span>
        </span>
      )}
    </button>
  )
})
