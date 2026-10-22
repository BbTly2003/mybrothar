'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { DominoTile } from './domino-tile'

/**
 * Intro cinematográfica del menú:
 *  1· Las 28 fichas de la baraja salen volando hacia la mesa y caen desparramadas.
 *  2· Cae un RAYO con fogonazo que sacude la mesa y la QUIEBRA (grieta + esquirlas).
 *  3· Con la mesa rota aparece el botón de JUGAR.
 * Se puede saltar tocando la pantalla y respeta prefers-reduced-motion.
 */

interface ScatterTile {
  a: number
  b: number
  x: number // % del ancho del fieltro
  y: number // % del alto del fieltro
  rot: number
  horizontal: boolean
  delay: number
  z: number
  size: 'xs' | 'sm'
  /** vector de entrada (desde fuera de la pantalla hacia su sitio) */
  fx: number
  fy: number
  fr: number
}

const BOLT_MS = 1900
const CRACK_MS = 2150
const READY_MS = 3050

/** Reparto aleatorio de las 28 fichas sobre el fieltro (con hueco libre en el centro) */
function makeScatter(w: number, h: number): ScatterTile[] {
  const deck: Array<[number, number]> = []
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) deck.push([a, b])
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }

  const size: 'xs' | 'sm' = w >= 560 ? 'sm' : 'xs'
  const minDist = (size === 'sm' ? 72 : 56) * 0.62
  const placed: Array<{ x: number; y: number }> = []

  return deck.map(([a, b], i) => {
    let x = 50
    let y = 50
    for (let t = 0; t < 60; t++) {
      x = 8 + Math.random() * 84
      y = 9 + Math.random() * 82
      // deja el centro despejado para el botón de Jugar
      if (Math.abs(x - 50) < 17 && Math.abs(y - 52) < 25) continue
      const px = (x / 100) * w
      const py = (y / 100) * h
      let ok = true
      for (const p of placed) {
        const dx = px - (p.x / 100) * w
        const dy = py - (p.y / 100) * h
        if (dx * dx + dy * dy < minDist * minDist) {
          ok = false
          break
        }
      }
      if (ok) break
    }
    placed.push({ x, y })

    const ang = Math.random() * Math.PI * 2
    const dist = 300 + Math.random() * 280
    return {
      a,
      b,
      x,
      y,
      rot: -42 + Math.random() * 84,
      horizontal: Math.random() < 0.5,
      delay: i * 0.045 + Math.random() * 0.07,
      z: Math.floor(Math.random() * 9),
      size,
      fx: Math.cos(ang) * dist,
      fy: Math.sin(ang) * dist,
      fr: Math.random() * 200 - 100,
    }
  })
}

/** Brazos de la grieta: trazos quebrados que salen del punto de impacto (50,55) */
const CRACK_ARMS = [
  'M50 55 L44 41 L48 30 L41 14',
  'M50 55 L57 43 L54 31 L61 15',
  'M50 55 L39 60 L27 57 L10 65',
  'M50 55 L61 63 L73 61 L90 71',
  'M50 55 L45 69 L49 84',
  'M50 55 L57 68 L55 87',
  'M50 55 L33 48 L18 44',
  'M50 55 L67 52 L82 40',
]

/** Ramillas secundarias de la grieta */
const CRACK_TWIGS = [
  'M48 30 L42 24 L43 17',
  'M54 31 L60 27 L59 20',
  'M39 60 L33 66 L34 74',
  'M61 63 L67 68 L66 76',
  'M45 69 L39 73 L40 79',
  'M33 48 L28 42 L21 41',
]

export function TableIntro({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([])
  const [phase, setPhase] = useState<'pre' | 'throwing' | 'bolt' | 'crack' | 'ready'>('pre')
  const [tiles, setTiles] = useState<ScatterTile[]>([])
  const gradientId = useId().replace(/[^a-zA-Z0-9_-]/g, '')

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setPhase('ready')
      return
    }
    const rect = rootRef.current?.getBoundingClientRect()
    setTiles(makeScatter(rect?.width ?? 700, rect?.height ?? 420))
    setPhase('throwing')
    const timers = timersRef.current
    timers.push(setTimeout(() => setPhase('bolt'), BOLT_MS))
    timers.push(setTimeout(() => setPhase('crack'), CRACK_MS))
    timers.push(setTimeout(() => setPhase('ready'), READY_MS))
    return () => timers.forEach(clearTimeout)
  }, [])

  // Un toque durante la intro la salta (el click no llega al botón: aún no existe)
  const skip = () => {
    if (phase === 'ready' || phase === 'pre') return
    timersRef.current.forEach(clearTimeout)
    setPhase('ready')
  }

  const impact = phase === 'bolt' || phase === 'crack'

  return (
    <div
      ref={rootRef}
      data-testid="table-intro"
      data-phase={phase}
      onClickCapture={phase === 'ready' ? undefined : skip}
      className="absolute inset-0"
    >
      {/* --- capa 1: las 28 fichas desparramadas --- */}
      {phase !== 'pre' && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {tiles.map((t, i) => (
            // contenedor exterior: vuelo de entrada (con muelle)
            <motion.div
              key={`${t.a}-${t.b}`}
              className="absolute"
              style={{ left: `${t.x}%`, top: `${t.y}%`, zIndex: t.z }}
              initial={{ x: t.fx, y: t.fy, rotate: t.rot + t.fr, opacity: 0, scale: 1.14 }}
              animate={{ x: 0, y: 0, rotate: t.rot, opacity: 1, scale: 1 }}
              transition={{
                x: { type: 'spring', stiffness: 230, damping: 20, delay: t.delay },
                y: { type: 'spring', stiffness: 230, damping: 20, delay: t.delay },
                rotate: { type: 'spring', stiffness: 160, damping: 17, delay: t.delay },
                opacity: { duration: 0.22, delay: t.delay },
                scale: { duration: 0.5, delay: t.delay },
              }}
            >
              {/* interior: brinco al impactar el rayo */}
              <motion.div
                className="-translate-x-1/2 -translate-y-1/2"
                animate={
                  phase === 'crack'
                    ? { y: [0, -10 - (i % 4) * 2, 0], rotate: [0, i % 2 ? 2.4 : -2.4, 0] }
                    : { y: 0, rotate: 0 }
                }
                transition={{ duration: 0.42, delay: (i % 5) * 0.03, ease: 'easeOut' }}
              >
                <DominoTile
                  top={t.a}
                  bottom={t.b}
                  size={t.size}
                  orientation={t.horizontal ? 'horizontal' : 'vertical'}
                  className="shadow-[0_2px_4px_rgba(0,0,0,0.45),0_8px_14px_rgba(0,0,0,0.25)]"
                />
              </motion.div>
            </motion.div>
          ))}
        </div>
      )}

      {/* --- capa 2: la grieta del fieltro --- */}
      {(phase === 'crack' || phase === 'ready') && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <radialGradient id={`${gradientId}-hole`}>
              <stop offset="0" stopColor="rgba(0,0,0,0.55)" />
              <stop offset="0.55" stopColor="rgba(0,0,0,0.22)" />
              <stop offset="1" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
          </defs>
          {/* hundimiento del impacto */}
          <motion.ellipse
            cx="50"
            cy="55"
            rx="17"
            ry="13"
            fill={`url(#${gradientId}-hole)`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
          />
          {/* trazos: sombra oscura + brillo interior desplazado = grieta profunda */}
          {CRACK_ARMS.map((d, i) => (
            <motion.path
              key={`a${i}`}
              d={d}
              fill="none"
              stroke="rgba(5,32,20,0.9)"
              strokeWidth="2.6"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.28, delay: 0.02 + i * 0.045, ease: 'circOut' }}
            />
          ))}
          {CRACK_ARMS.map((d, i) => (
            <motion.path
              key={`l${i}`}
              d={d}
              fill="none"
              stroke="rgba(190,255,220,0.5)"
              strokeWidth="1"
              strokeLinecap="round"
              transform="translate(0.45 0.55)"
              vectorEffect="non-scaling-stroke"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.28, delay: 0.05 + i * 0.045, ease: 'circOut' }}
            />
          ))}
          {CRACK_TWIGS.map((d, i) => (
            <motion.path
              key={`t${i}`}
              d={d}
              fill="none"
              stroke="rgba(5,32,20,0.75)"
              strokeWidth="1.4"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.2, delay: 0.14 + i * 0.05, ease: 'circOut' }}
            />
          ))}
        </svg>
      )}

      {/* --- capa 3: esquirlas de marfil y fieltro saliendo del impacto --- */}
      {phase === 'crack' && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {Array.from({ length: 12 }).map((_, i) => {
            const ang = (i / 12) * Math.PI * 2 + Math.random() * 0.5
            const dist = 46 + Math.random() * 110
            const ivory = i % 3 !== 2
            return (
              <motion.span
                key={i}
                className={
                  'absolute left-1/2 top-[55%] h-[7px] w-[13px] rounded-[2px] ' +
                  (ivory
                    ? 'bg-[linear-gradient(150deg,#f6efdc,#d9cca8)]'
                    : 'bg-[linear-gradient(150deg,#2f9e6e,#14724c)]')
                }
                style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
                initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos(ang) * dist,
                  y: Math.sin(ang) * dist * 0.8 + 26,
                  rotate: Math.random() * 520 - 260,
                  opacity: 0,
                  scale: 0.7,
                }}
                transition={{ duration: 0.7 + Math.random() * 0.25, ease: 'easeOut' }}
              />
            )
          })}
        </div>
      )}

      {/* --- capa 4: el rayo --- */}
      {impact && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.15, 1, 0.45, 1, 0] }}
            transition={{ duration: 0.55, times: [0, 0.08, 0.2, 0.32, 0.5, 0.68, 1] }}
            style={{ filter: 'drop-shadow(0 0 5px rgba(190,255,230,0.95))' }}
          >
            <polyline
              points="56,-3 47,16 54,31 43,47 50,55"
              fill="none"
              stroke="#f4fffb"
              strokeWidth="2.6"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <polyline
              points="47,16 38,26 41,34"
              fill="none"
              stroke="rgba(220,255,240,0.85)"
              strokeWidth="1.4"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <polyline
              points="43,47 55,44 63,50"
              fill="none"
              stroke="rgba(220,255,240,0.7)"
              strokeWidth="1.2"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </motion.g>
        </svg>
      )}

      {/* --- fogonazo sobre toda la app --- */}
      {phase === 'bolt' && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[60] bg-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.92, 0.08, 0.5, 0] }}
          transition={{ duration: 0.5, times: [0, 0.1, 0.35, 0.55, 1] }}
          aria-hidden
        />
      )}

      {/* --- sacudida de la mesa + contenido (botón) al final --- */}
      <motion.div
        className="relative flex h-full w-full flex-col items-center justify-center gap-5 p-3"
        animate={
          phase === 'bolt'
            ? { x: [0, -8, 7, -5, 3, -1, 0], y: [0, 5, -5, 3, -2, 1, 0] }
            : { x: 0, y: 0 }
        }
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        {phase === 'ready' && (
          <motion.div
            className="flex flex-col items-center gap-5"
            initial={{ opacity: 0, scale: 0.82, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          >
            {children}
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
