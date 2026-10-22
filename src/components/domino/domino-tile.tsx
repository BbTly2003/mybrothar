'use client'

import { memo, useId, type CSSProperties } from 'react'
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

/** Centros de las 3×3 celdas dentro de una mitad de 100×100 unidades SVG */
const CELL = [20, 50, 80]
/** Radio de los puntos (15% del ancho de la mitad, como las fichas reales) */
const PIP_R = 7.5
/** Radio del clavo central (spinner) */
const SPINNER_R = 4.2

const TILE_SIZES = {
  xs: {
    vertical: 'h-[50px] w-[25px] rounded-[5px]',
    horizontal: 'h-[25px] w-[50px] rounded-[5px]',
    /** radio de esquina en unidades SVG (100 = lado corto) para coincidir con el CSS */
    rx: 20,
  },
  sm: {
    vertical: 'h-16 w-8 rounded-[7px]',
    horizontal: 'h-8 w-16 rounded-[7px]',
    rx: 22,
  },
  md: {
    vertical: 'h-20 w-10 rounded-lg sm:h-22 sm:w-11',
    horizontal: 'h-10 w-20 rounded-lg sm:h-11 sm:w-22',
    rx: 18,
  },
  lg: {
    vertical: 'h-24 w-12 rounded-lg sm:h-28 sm:w-14',
    horizontal: 'h-12 w-24 rounded-lg sm:h-14 sm:w-28',
    rx: 14,
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

/**
 * Cara de la ficha dibujada en SVG vectorial (nitidez total a cualquier DPI):
 * cuerpo de marfil con grano fino, brillo de pulido, bisel con luz arriba y
 * sombra cálida abajo, ranura divisoria grabada con clavo central y puntos
 * azules con degradado taladrado como las fichas físicas reales.
 */
function TileFace({
  top,
  bottom,
  orientation,
  faceDown,
  uid,
  rx,
}: {
  top: number
  bottom: number
  orientation: 'vertical' | 'horizontal'
  faceDown: boolean
  uid: string
  rx: number
}) {
  const vertical = orientation === 'vertical'
  const W = vertical ? 100 : 200
  const H = vertical ? 200 : 100
  const id = (name: string) => `${uid}-${name}`
  const url = (name: string) => `url(#${id(name)})`

  /**
   * Centros de los puntos de un valor dentro de su mitad (half 0 = primera).
   * En horizontal la mitad gira 90° como la ficha física: (r,c) → (c, 2-r).
   */
  const pipsFor = (value: number, half: 0 | 1) =>
    (PIP_POSITIONS[value] ?? [])
      .map(([r, c]) => (vertical ? ([r, c] as [number, number]) : ([c, 2 - r] as [number, number])))
      .map(([r, c]) => ({
        cx: (vertical ? CELL[c] : CELL[c]) + (vertical ? 0 : 100 * half),
        cy: (vertical ? CELL[r] : CELL[r]) + (vertical ? 100 * half : 0),
      }))

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="block h-full w-full"
      aria-hidden
      shapeRendering="geometricPrecision"
    >
      <defs>
        {/* pasta de marfil: luz suave arriba-izquierda, warmth abajo */}
        <linearGradient id={id('body')} x1="0.18" y1="0" x2="0.62" y2="1">
          <stop offset="0" stopColor="#fbf6e8" />
          <stop offset="0.4" stopColor="#f4edda" />
          <stop offset="0.75" stopColor="#ebe1c7" />
          <stop offset="1" stopColor="#dbcfad" />
        </linearGradient>
        {/* profundidad cálida en la base de la ficha */}
        <linearGradient id={id('shade')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" stopColor="rgba(128,101,56,0)" />
          <stop offset="1" stopColor="rgba(128,101,56,0.26)" />
        </linearGradient>
        {/* brillo de pulido (gloss) arriba */}
        <radialGradient id={id('sheen')} cx="0.3" cy="0.06" r="0.9">
          <stop offset="0" stopColor="rgba(255,255,255,0.7)" />
          <stop offset="0.45" stopColor="rgba(255,255,255,0.16)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        {/* bisel: arista iluminada arriba, sombra de grosor abajo */}
        <linearGradient id={id('rim')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(255,255,255,0.95)" />
          <stop offset="0.3" stopColor="rgba(255,255,255,0.28)" />
          <stop offset="0.75" stopColor="rgba(146,118,68,0.28)" />
          <stop offset="1" stopColor="rgba(110,86,46,0.6)" />
        </linearGradient>
        {/* punto taladrado: micro-brillo arriba-izquierda, fondo profundo */}
        <radialGradient id={id('pip')} cx="0.36" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#2e3550" />
          <stop offset="0.45" stopColor="#1f2436" />
          <stop offset="1" stopColor="#0e1220" />
        </radialGradient>
        {/* marca esmeralda del reverso */}
        <radialGradient id={id('mark')} cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#4ade9f" />
          <stop offset="0.5" stopColor="#12b981" />
          <stop offset="1" stopColor="#036a4d" />
        </radialGradient>
        {/* grano fino del marfil (ruido fractal recortado a la ficha) */}
        <filter id={id('grain')} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.44  0 0 0 0 0.37  0 0 0 0 0.24  0 0 0 0.6 0"
          />
          <feComposite operator="in" in2="SourceGraphic" />
        </filter>
      </defs>

      {/* cuerpo + capas de material */}
      <rect x="1" y="1" width={W - 2} height={H - 2} rx={rx} fill={url('body')} />
      <rect x="1" y="1" width={W - 2} height={H - 2} rx={rx} fill={url('shade')} />
      <rect
        x="1"
        y="1"
        width={W - 2}
        height={H - 2}
        rx={rx}
        fill="#ffffff"
        filter={url('grain')}
        opacity="0.16"
      />
      <rect x="1" y="1" width={W - 2} height={H - 2} rx={rx} fill={url('sheen')} />
      <rect
        x="1.5"
        y="1.5"
        width={W - 3}
        height={H - 3}
        rx={Math.max(rx - 0.5, 2)}
        fill="none"
        stroke={url('rim')}
        strokeWidth="1.6"
      />

      {faceDown ? (
        <g>
          <circle cx={W / 2} cy={H / 2} r={7} fill={url('mark')} />
          <ellipse cx={W / 2 - 1.4} cy={H / 2 - 1.8} rx="2" ry="1.4" fill="rgba(255,255,255,0.4)" />
        </g>
      ) : (
        <g>
          {/* ranura divisoria grabada: trazo oscuro + luz que rebota al lado */}
          {vertical ? (
            <>
              <line x1="8" y1="100" x2="92" y2="100" stroke="#333949" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="10" y1="101.8" x2="90" y2="101.8" stroke="rgba(255,255,255,0.66)" strokeWidth="0.9" strokeLinecap="round" />
            </>
          ) : (
            <>
              <line x1="100" y1="8" x2="100" y2="92" stroke="#333949" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="101.8" y1="10" x2="101.8" y2="90" stroke="rgba(255,255,255,0.66)" strokeWidth="0.9" strokeLinecap="round" />
            </>
          )}
          {/* clavo central (spinner) */}
          <circle cx={W / 2} cy={H / 2} r={SPINNER_R} fill={url('pip')} />
          <ellipse cx={W / 2 - 0.8} cy={H / 2 - 1} rx="1.2" ry="0.85" fill="rgba(255,255,255,0.32)" />
          {/* puntos de ambas mitades */}
          {pipsFor(top, 0).map(({ cx, cy }, i) => (
            <circle key={`t${i}`} cx={cx} cy={cy} r={PIP_R} fill={url('pip')} />
          ))}
          {pipsFor(bottom, 1).map(({ cx, cy }, i) => (
            <circle key={`b${i}`} cx={cx} cy={cy} r={PIP_R} fill={url('pip')} />
          ))}
        </g>
      )}
    </svg>
  )
}

/**
 * Ficha de dominó calidad Full HD: la cara es SVG vectorial (nitidez infinita,
 * grano de marfil, gloss y bisel físico) y el botón aporta tamaño, esquinas y
 * las señales de juego (aro esmeralda de jugable, highlight ámbar, glow).
 * Vertical = mitades apiladas · Horizontal = mitades lado a lado.
 * El doble se coloca en cruz (vertical sobre la cadena).
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
  const rx = sizeConfig.rx
  // id único por instancia para los gradientes/filtros del SVG
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')

  const interactive = playable && !disabled && !!onClick && !faceDown

  return (
    <button
      type="button"
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      aria-label={ariaLabel}
      style={style}
      className={cn(
        'relative flex shrink-0 select-none items-center justify-center p-0 transition-all duration-150',
        box,
        faceDown
          ? 'shadow-[0_1px_2px_rgba(58,36,14,0.4),0_3px_7px_rgba(58,36,14,0.3)]'
          : 'shadow-[0_1px_2px_rgba(58,36,14,0.35),0_4px_9px_rgba(58,36,14,0.28),0_12px_22px_rgba(58,36,14,0.18)]',
        // Jugable: SIEMPRE levantada (más que las demás) para que se vea de un vistazo
        // qué fichas puedes jugar — como en la mesa real, sin ayuda de nadie.
        interactive &&
          'cursor-grab -translate-y-2 shadow-[0_0_0_2px_rgba(16,185,129,0.8),0_10px_20px_rgba(16,185,129,0.25),0_6px_12px_rgba(58,36,14,0.32)] hover:-translate-y-4 hover:cursor-grabbing hover:shadow-[0_0_0_2px_rgba(52,211,153,0.95),0_16px_26px_rgba(16,185,129,0.35),0_10px_18px_rgba(58,36,14,0.3)] focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_rgba(52,211,153,0.95)]',
        !interactive && 'cursor-default',
        disabled && !faceDown && 'brightness-[0.95]',
        highlight && 'shadow-[0_0_0_3px_#fbbf24,0_3px_6px_rgba(58,36,14,0.35)]',
        glow &&
          !highlight &&
          !interactive &&
          'shadow-[0_0_0_2px_rgba(52,211,153,0.9),0_4px_12px_rgba(16,185,129,0.45)]',
        className,
      )}
    >
      <TileFace
        top={top}
        bottom={bottom}
        orientation={orientation}
        faceDown={faceDown}
        uid={uid}
        rx={rx}
      />
    </button>
  )
})
