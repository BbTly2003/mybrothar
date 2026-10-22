'use client'

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { DominoTile } from './domino-tile'
import { playSfx } from '@/lib/sfx'

/**
 * Intro cinematográfica 4K del menú:
 *  1· Las 28 fichas de la baraja CAEN DEL CIELO con tumbo 3D, sombra de contacto
 *     y una nube de polvo al aterrizar (la mesa se oscurece: viene la tormenta).
 *  2· Cae un RAYO ramificado multicapa (núcleo blanco + halo + glow) con trueno,
 *     fogonazo y sacudida de cámara que QUIEBRA la mesa (grieta + brasas + esquirlas).
 *  3· Sobre la mesa rota, con brasas flotando, aparece el botón de JUGAR.
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
  fall: number // duración de la caída (s)
  z: number
  size: 'xs' | 'sm'
  /** deriva horizontal durante la caída (px) */
  fx: number
  /** altura de entrada: arranca por encima de la pantalla (px) */
  fy: number
  /** tumbo 3D en grados */
  flipX: number
  flipY: number
  spin: number
}

const STORM_MS = 1150 // la mesa se oscurece: viene el rayo
const BOLT_MS = 1900 // el rayo cae
const CRACK_MS = 2150 // la mesa quiebra
const READY_MS = 3200 // aparece JUGAR

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

    return {
      a,
      b,
      x,
      y,
      rot: -42 + Math.random() * 84,
      horizontal: Math.random() < 0.5,
      delay: i * 0.032 + Math.random() * 0.05,
      fall: 0.78 + Math.random() * 0.28,
      z: Math.floor(Math.random() * 9),
      size,
      fx: -90 + Math.random() * 180,
      fy: -(h + 160 + Math.random() * 280),
      flipX: (Math.random() < 0.5 ? -1 : 1) * (260 + Math.random() * 400),
      flipY: (Math.random() < 0.5 ? -1 : 1) * (Math.random() * 170),
      spin: Math.random() * 190 - 95,
    }
  })
}

/** Brasas ambientales flotando sobre la mesa rota (fase ready) */
function makeEmbers(): Array<{ x: number; y: number; s: number; d: number; dur: number; drift: number; ember: boolean }> {
  return Array.from({ length: 14 }, () => ({
    x: 6 + Math.random() * 88,
    y: 30 + Math.random() * 62,
    s: 2 + Math.random() * 2.4,
    d: Math.random() * 2.2,
    dur: 2.3 + Math.random() * 1.7,
    drift: -14 + Math.random() * 28,
    ember: Math.random() < 0.55,
  }))
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

/** Ramas eléctricas del rayo (además del canal principal) */
const BOLT_BRANCHES = [
  'M47 16 L38 26 L40 34',
  'M43 47 L55 44 L64 51',
  'M54 31 L63 36 L71 33',
  'M47 16 L50 8 L58 4',
]

type IntroPhase = 'pre' | 'throwing' | 'bolt' | 'crack' | 'ready'

export function TableIntro({
  children,
  onPhaseChange,
}: {
  children: ReactNode
  onPhaseChange?: (phase: IntroPhase) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([])
  const [phase, setPhase] = useState<IntroPhase>('pre')
  const [storm, setStorm] = useState(false)
  const [tiles, setTiles] = useState<ScatterTile[]>([])
  const [reduced, setReduced] = useState(false)
  const gradientId = useId().replace(/[^a-zA-Z0-9_-]/g, '')

  const onPhaseRef = useRef(onPhaseChange)
  onPhaseRef.current = onPhaseChange
  /** cambia de fase y avisa a la mesa (la bandera se revela con el rayo) */
  const go = (p: IntroPhase) => {
    setPhase(p)
    onPhaseRef.current?.(p)
  }

  useEffect(() => {
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (isReduced) {
      setReduced(true)
      go('ready')
      return
    }
    const rect = rootRef.current?.getBoundingClientRect()
    const scatter = makeScatter(rect?.width ?? 700, rect?.height ?? 420)
    setTiles(scatter)
    go('throwing')

    const timers = timersRef.current
    // golpes sordos de cada ficha al aterrizar (~60% de su caída)
    for (const t of scatter) {
      timers.push(setTimeout(() => playSfx('thud'), (t.delay + t.fall * 0.62) * 1000))
    }
    timers.push(setTimeout(() => setStorm(true), STORM_MS))
    timers.push(
      setTimeout(() => {
        playSfx('thunder')
        go('bolt')
      }, BOLT_MS),
    )
    timers.push(setTimeout(() => go('crack'), CRACK_MS))
    timers.push(setTimeout(() => go('ready'), READY_MS))
    return () => timers.forEach(clearTimeout)
  }, [])

  // Un toque durante la intro la salta (el click no llega al botón: aún no existe)
  const skip = () => {
    if (phase === 'ready' || phase === 'pre') return
    timersRef.current.forEach(clearTimeout)
    go('ready')
  }

  const impact = phase === 'bolt' || phase === 'crack'
  const embers = useMemo(() => (phase === 'ready' && !reduced ? makeEmbers() : []), [phase, reduced])

  return (
    <div
      ref={rootRef}
      data-testid="table-intro"
      data-phase={phase}
      onClickCapture={phase === 'ready' ? undefined : skip}
      className="absolute inset-0"
    >
      {/* ===== capa de atmósfera: oscuridad de tormenta + viñeta de cine ===== */}
      <motion.div
        className="pointer-events-none absolute inset-0 bg-black"
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{
          opacity:
            phase === 'bolt'
              ? 0.32
              : phase === 'crack'
                ? 0.14
                : phase === 'ready'
                  ? 0.12
                  : storm
                    ? 0.46
                    : 0,
        }}
        transition={{ duration: phase === 'bolt' ? 0.12 : 0.55, ease: 'easeOut' }}
      />
      <motion.div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(0,0,0,0.62)_100%)]"
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'ready' ? 0.4 : storm || impact ? 0.8 : 0 }}
        transition={{ duration: 0.6 }}
      />

      {/* ===== cámara: todo lo físico se sacude con el impacto ===== */}
      <motion.div
        className="absolute inset-0"
        style={{ perspective: 1100 }}
        animate={
          phase === 'bolt'
            ? {
                x: [0, -10, 9, -6, 4, -2, 0],
                y: [0, 6, -6, 4, -2, 1, 0],
                scale: [1, 1.03, 1.014, 1],
              }
            : { x: 0, y: 0, scale: 1 }
        }
        transition={{ duration: 0.55, ease: 'easeOut' }}
      >
        {/* ---- capa 1: sombras de contacto (bajo cada ficha que cae) ---- */}
        {phase !== 'pre' && !reduced && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            {tiles.map((t) => (
              <motion.div
                key={`sh-${t.a}-${t.b}`}
                className={'absolute rounded-full bg-black/45 blur-[6px] ' + (t.horizontal ? '-translate-x-1/2 -translate-y-1/2' : '-translate-x-1/2 -translate-y-1/2')}
                style={{
                  left: `${t.x}%`,
                  top: `${t.y}%`,
                  width: t.horizontal ? (t.size === 'sm' ? 58 : 44) : t.size === 'sm' ? 30 : 24,
                  height: t.horizontal ? (t.size === 'sm' ? 20 : 16) : t.size === 'sm' ? 50 : 40,
                  zIndex: t.z,
                }}
                initial={{ opacity: 0, scale: 0.45 }}
                animate={{ opacity: 0.42, scale: 1 }}
                transition={{ delay: t.delay + t.fall * 0.55, duration: 0.26, ease: 'easeOut' }}
              />
            ))}
          </div>
        )}

        {/* ---- capa 2: las 28 fichas cayendo del cielo con tumbo 3D ---- */}
        {phase !== 'pre' && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            {tiles.map((t, i) => (
              // contenedor exterior: caída con tumbo 3D y rebote al aterrizar
              <motion.div
                key={`${t.a}-${t.b}`}
                className="absolute"
                style={{ left: `${t.x}%`, top: `${t.y}%`, zIndex: t.z }}
                initial={{
                  x: t.fx,
                  y: t.fy,
                  rotate: t.rot + t.spin,
                  rotateX: t.flipX,
                  rotateY: t.flipY,
                  opacity: 0,
                  scale: 0.88,
                }}
                animate={{
                  x: 0,
                  y: [t.fy, 0, -12, 0],
                  rotate: t.rot,
                  rotateX: 0,
                  rotateY: 0,
                  opacity: 1,
                  scale: 1,
                }}
                transition={{
                  x: { duration: t.fall, ease: 'easeOut' },
                  y: {
                    duration: t.fall,
                    times: [0, 0.6, 0.8, 1],
                    ease: ['easeIn', 'easeOut', 'easeIn'],
                  },
                  rotate: { duration: t.fall, ease: 'easeOut' },
                  rotateX: { duration: t.fall, ease: 'easeOut' },
                  rotateY: { duration: t.fall, ease: 'easeOut' },
                  opacity: { duration: 0.16 },
                  scale: { duration: t.fall, ease: 'easeOut' },
                }}
              >
                {/* interior: brinco 3D al impactar el rayo */}
                <motion.div
                  className="-translate-x-1/2 -translate-y-1/2"
                  animate={
                    phase === 'crack'
                      ? {
                          y: [0, -10 - (i % 4) * 2, 0],
                          rotate: [0, i % 2 ? 2.4 : -2.4, 0],
                          rotateX: [0, i % 2 ? -8 : 8, 0],
                        }
                      : { y: 0, rotate: 0, rotateX: 0 }
                  }
                  transition={{ duration: 0.46, delay: (i % 5) * 0.03, ease: 'easeOut' }}
                >
                  <DominoTile
                    top={t.a}
                    bottom={t.b}
                    size={t.size}
                    orientation={t.horizontal ? 'horizontal' : 'vertical'}
                    className="shadow-[0_2px_4px_rgba(0,0,0,0.45),0_10px_16px_rgba(0,0,0,0.28)]"
                  />
                </motion.div>
              </motion.div>
            ))}
          </div>
        )}

        {/* ---- capa 2b: nube de polvo al aterrizar cada ficha ---- */}
        {phase !== 'pre' && !reduced && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            {tiles.map((t) => (
              <motion.span
                key={`pf-${t.a}-${t.b}`}
                className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e6efe8]/25 blur-[3px]"
                style={{ left: `${t.x}%`, top: `${t.y}%`, zIndex: t.z }}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: [0, 0.5, 0], scale: 2.1 }}
                transition={{ delay: t.delay + t.fall * 0.6, duration: 0.42, ease: 'easeOut' }}
              />
            ))}
          </div>
        )}

        {/* ---- capa 3: la grieta del fieltro (con brasas incandescentes) ---- */}
        {(phase === 'crack' || phase === 'ready') && (
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <radialGradient id={`${gradientId}-hole`}>
                <stop offset="0" stopColor="rgba(0,0,0,0.68)" />
                <stop offset="0.5" stopColor="rgba(0,0,0,0.28)" />
                <stop offset="1" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
              <radialGradient id={`${gradientId}-scorch`}>
                <stop offset="0" stopColor="rgba(10,6,2,0.75)" />
                <stop offset="0.6" stopColor="rgba(20,12,4,0.35)" />
                <stop offset="1" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
            </defs>

            {/* hundimiento del impacto + quemadura */}
            <motion.ellipse
              cx="50"
              cy="55"
              rx="17"
              ry="13"
              fill={`url(#${gradientId}-hole)`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            />
            <motion.ellipse
              cx="50"
              cy="55"
              rx="10"
              ry="7.5"
              fill={`url(#${gradientId}-scorch)`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45, delay: 0.08 }}
            />

            {/* ONDA EXPANSIVA: anillo blanco que se expande y muere */}
            {phase === 'crack' && (
              <motion.ellipse
                cx="50"
                cy="55"
                rx="16"
                ry="11"
                fill="none"
                stroke="rgba(255,255,255,0.85)"
                strokeWidth="2.4"
                vectorEffect="non-scaling-stroke"
                style={{ transformBox: 'view-box', transformOrigin: '50% 55%' }}
                initial={{ scale: 0.25, opacity: 0.95 }}
                animate={{ scale: 3.6, opacity: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            )}

            {/* trazos: sombra oscura + brillo interior desplazado = grieta profunda */}
            {CRACK_ARMS.map((d, i) => (
              <motion.path
                key={`a${i}`}
                d={d}
                fill="none"
                stroke="rgba(3,3,5,0.92)"
                strokeWidth="2.6"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.26, delay: 0.02 + i * 0.04, ease: 'circOut' }}
              />
            ))}
            {CRACK_ARMS.map((d, i) => (
              <motion.path
                key={`l${i}`}
                d={d}
                fill="none"
                stroke="rgba(232,242,255,0.6)"
                strokeWidth="1"
                strokeLinecap="round"
                transform="translate(0.45 0.55)"
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.26, delay: 0.05 + i * 0.04, ease: 'circOut' }}
              />
            ))}
            {CRACK_TWIGS.map((d, i) => (
              <motion.path
                key={`t${i}`}
                d={d}
                fill="none"
                stroke="rgba(4,4,6,0.8)"
                strokeWidth="1.4"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.2, delay: 0.13 + i * 0.045, ease: 'circOut' }}
              />
            ))}

            {/* BRASAS: la grieta queda incandescente y se enfría pulsando */}
            <g style={{ filter: 'drop-shadow(0 0 3px rgba(255,168,70,0.85))' }}>
              {CRACK_ARMS.map((d, i) => (
                <motion.path
                  key={`e${i}`}
                  d={d}
                  fill="none"
                  stroke={i % 2 ? '#ffc36e' : '#ff9d3d'}
                  strokeWidth="1.1"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.95, 0.42, 0.6, 0.34, 0.46, 0.34] }}
                  transition={{
                    duration: 2.2,
                    times: [0, 0.08, 0.3, 0.5, 0.68, 0.85, 1],
                    delay: 0.06 + i * 0.02,
                  }}
                />
              ))}
            </g>
          </svg>
        )}

        {/* ---- capa 3b: brasas incandescentes latiendo (ambientación ready) ---- */}
        {phase === 'ready' && (
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            <g style={{ filter: 'drop-shadow(0 0 2.5px rgba(255,150,60,0.7))' }}>
              {CRACK_ARMS.map((d, i) => (
                <motion.path
                  key={`ep${i}`}
                  d={d}
                  fill="none"
                  stroke={i % 3 === 0 ? '#ffb35e' : '#ff8c2e'}
                  strokeWidth="0.9"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  initial={{ opacity: 0.3 }}
                  animate={{ opacity: [0.2, 0.5, 0.2] }}
                  transition={{ duration: 2.6 + (i % 4) * 0.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
                />
              ))}
            </g>
          </svg>
        )}

        {/* ---- capa 4: esquirlas con gravedad + polvo del impacto ---- */}
        {phase === 'crack' && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            {Array.from({ length: 18 }).map((_, i) => {
              const ang = (i / 18) * Math.PI * 2 + Math.random() * 0.5
              const dist = 52 + Math.random() * 130
              const dy = Math.sin(ang) * dist * 0.7 + 22
              const ivory = i % 3 !== 2
              return (
                <motion.span
                  key={i}
                  className={
                    'absolute left-1/2 top-[55%] h-[7px] w-[13px] rounded-[2px] ' +
                    (ivory
                      ? 'bg-[linear-gradient(150deg,#f6efdc,#d9cca8)]'
                      : 'bg-[linear-gradient(150deg,#2b303a,#0b0d12)]')
                  }
                  style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
                  initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 1 }}
                  animate={{
                    x: Math.cos(ang) * dist,
                    y: [0, dy, dy * 1.75],
                    rotate: Math.random() * 620 - 310,
                    opacity: [1, 1, 0],
                    scale: 0.65,
                  }}
                  transition={{
                    x: { duration: 0.85, ease: 'easeOut' },
                    y: { duration: 0.85, times: [0, 0.5, 1], ease: ['easeOut', 'easeIn'] },
                    rotate: { duration: 0.85, ease: 'easeOut' },
                    opacity: { duration: 0.85, times: [0, 0.55, 1] },
                    scale: { duration: 0.85 },
                  }}
                />
              )
            })}
            {/* nubes de polvo del impacto */}
            {Array.from({ length: 6 }).map((_, i) => {
              const ang = (i / 6) * Math.PI * 2
              return (
                <motion.span
                  key={`d${i}`}
                  className="absolute left-1/2 top-[55%] h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#cfd8cd]/30 blur-[6px]"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{
                    opacity: [0, 0.55, 0],
                    scale: 2.8,
                    x: Math.cos(ang) * 40,
                    y: Math.sin(ang) * 26,
                  }}
                  transition={{ duration: 0.65, delay: 0.04 + i * 0.02, ease: 'easeOut' }}
                />
              )
            })}
          </div>
        )}

        {/* ---- capa 5: el rayo ramificado multicapa ---- */}
        {phase === 'bolt' && (
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <filter id={`${gradientId}-bglow`} x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="2.2" />
              </filter>
              <radialGradient id={`${gradientId}-halo`}>
                <stop offset="0" stopColor="rgba(255,255,255,0.95)" />
                <stop offset="0.35" stopColor="rgba(230,255,244,0.5)" />
                <stop offset="1" stopColor="rgba(200,255,230,0)" />
              </radialGradient>
            </defs>

            {/* canal principal: glow + cuerpo + núcleo blanco */}
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.25, 1, 0.5, 1, 0] }}
              transition={{ duration: 0.58, times: [0, 0.07, 0.2, 0.32, 0.5, 0.66, 1] }}
            >
              {/* halo del impacto */}
              <motion.circle
                cx="50"
                cy="55"
                r="11"
                fill={`url(#${gradientId}-halo)`}
                style={{ transformBox: 'view-box', transformOrigin: '50% 55%' }}
                initial={{ scale: 0.4, opacity: 0.4 }}
                animate={{ scale: [0.4, 2.4, 3.1], opacity: [0.4, 0.95, 0] }}
                transition={{ duration: 0.55, times: [0, 0.45, 1], ease: 'easeOut' }}
              />
              {/* glow exterior */}
              <motion.path
                d="M56 -4 L47 16 L54 31 L43 47 L50 55"
                fill="none"
                stroke="rgba(225,255,242,0.55)"
                strokeWidth="13"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                filter={`url(#${gradientId}-bglow)`}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.13, ease: 'linear' }}
              />
              {/* cuerpo */}
              <motion.path
                d="M56 -4 L47 16 L54 31 L43 47 L50 55"
                fill="none"
                stroke="rgba(244,255,250,0.92)"
                strokeWidth="5.5"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.13, ease: 'linear' }}
              />
              {/* núcleo blanco */}
              <motion.path
                d="M56 -4 L47 16 L54 31 L43 47 L50 55"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.2"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.13, ease: 'linear' }}
              />
            </motion.g>

            {/* ramas eléctricas secundarias */}
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.9, 0.15, 0.7, 0] }}
              transition={{ duration: 0.5, times: [0, 0.12, 0.38, 0.6, 1], delay: 0.05 }}
              style={{ filter: 'drop-shadow(0 0 3px rgba(220,255,240,0.8))' }}
            >
              {BOLT_BRANCHES.map((d, i) => (
                <motion.path
                  key={i}
                  d={d}
                  fill="none"
                  stroke="rgba(235,255,247,0.9)"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.1, delay: 0.05 + i * 0.015, ease: 'linear' }}
                />
              ))}
            </motion.g>
          </svg>
        )}

        {/* ---- capa 6: fogonazo de doble pulso sobre toda la app ---- */}
        {phase === 'bolt' && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-[60] bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.95, 0.1, 0.62, 0.14, 0.32, 0] }}
            transition={{ duration: 0.62, times: [0, 0.08, 0.3, 0.45, 0.62, 0.78, 1] }}
            aria-hidden
          />
        )}

        {/* ---- contenido (botón) al final, con halo de brasas: sobre las fichas ---- */}
        <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-5 p-3">
          {phase === 'ready' && (
            <motion.div
              className="relative flex flex-col items-center gap-5"
              initial={{ opacity: 0, scale: 0.8, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 330, damping: 21 }}
            >
              {/* halo pulsante de energía detrás del botón */}
              {!reduced && (
                <motion.span
                  className="pointer-events-none absolute -inset-3 rounded-[2.4rem] bg-purple-300/25 blur-lg"
                  aria-hidden
                  animate={{ opacity: [0.3, 0.65, 0.3], scale: [0.97, 1.03, 0.97] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              {/* chispa eléctrica de entrada */}
              {!reduced && (
                <motion.span
                  className="pointer-events-none absolute -inset-1.5 rounded-[2.1rem] border-2 border-purple-100/80"
                  aria-hidden
                  initial={{ opacity: 0.95, scale: 1.18 }}
                  animate={{ opacity: 0, scale: 1 }}
                  transition={{ duration: 0.55, ease: 'easeOut' }}
                />
              )}
              <div className="relative">{children}</div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* ---- brasas flotando sobre la mesa rota (ambientación) ---- */}
      {phase === 'ready' && !reduced && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {embers.map((e, i) => (
            <motion.span
              key={i}
              className={'absolute rounded-full ' + (e.ember ? 'bg-[#ffb45e]' : 'bg-[#f0e6cd]')}
              style={{
                left: `${e.x}%`,
                top: `${e.y}%`,
                width: e.s,
                height: e.s,
                boxShadow: e.ember ? '0 0 6px rgba(255,150,60,0.9)' : '0 0 4px rgba(240,230,205,0.7)',
              }}
              initial={{ opacity: 0, y: 0, x: 0 }}
              animate={{ opacity: [0, 0.85, 0], y: -34, x: e.drift }}
              transition={{ duration: e.dur, repeat: Infinity, delay: e.d, ease: 'easeInOut' }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
