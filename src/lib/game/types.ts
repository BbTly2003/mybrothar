// Tipos del juego de dominó

/** Ficha sin jugar: a y b son sus dos valores de puntos (orientación libre) */
export interface Tile {
  id: number
  a: number
  b: number
}

/** Ficha colocada en la cadena, ya orientada: left conecta hacia la izquierda, right hacia la derecha */
export interface PlacedTile {
  id: number
  left: number
  right: number
}

export type Side = 'left' | 'right'

export type LogKind = 'info' | 'play' | 'pass' | 'win' | 'lose' | 'system'

export interface LogEntry {
  id: number
  text: string
  kind: LogKind
}

export type OutcomeType =
  | 'win' // el humano quedó sin fichas
  | 'loss' // un bot quedó sin fichas
  | 'blocked-win' // mesa bloqueada, el humano tenía la mano más ligera (o empató)
  | 'blocked-loss' // mesa bloqueada, ganó un bot

export interface GameOutcome {
  type: OutcomeType
  /** asiento ganador (0-3) o null si corresponde */
  winnerSeat: number | null
  /** resumen de puntos por asiento al bloquearse la mesa */
  pipSums?: number[]
  /** texto explicativo para el diálogo final */
  message: string
}

export interface GameState {
  /** manos por asiento: 0 = humano, 1-3 = bots */
  hands: Tile[][]
  /** cadena de fichas sobre la mesa, en orden */
  chain: PlacedTile[]
  /** asiento al que le toca */
  turn: number
  /** asiento que comenzó la partida */
  starter: number
  /** pases consecutivos (4 => mesa bloqueada) */
  passesInRow: number
  phase: 'playing' | 'finished'
  outcome: GameOutcome | null
  /** id de la ficha obligatoria con la que debe iniciar el que tiene el doble más alto */
  requiredFirstTileId: number | null
  /** último lado donde se jugó (para auto-scroll del tablero) */
  lastSide: Side | null
  log: LogEntry[]
  logSeq: number
}

/**
 * Nombres por asiento. El turno SIEMPRE pasa al jugador de la DERECHA del que
 * acaba de jugar (visto desde arriba la mesa avanza en sentido antihorario):
 *   Tú (abajo) → Kira (derecha) → Max (frente/arriba) → Lola (izquierda) → Tú
 */
export const SEAT_NAMES = ['Tú', 'Lola', 'Max', 'Kira'] as const

/** Avatar emoji por asiento (estilo Plato) */
export const SEAT_AVATARS = ['😎', '🐼', '🦊', '🐯'] as const

/** Degradado del círculo de avatar por asiento */
export const SEAT_AVATAR_CLASS = [
  'from-emerald-300 to-emerald-600',
  'from-rose-300 to-rose-500',
  'from-amber-300 to-amber-500',
  'from-violet-300 to-violet-500',
] as const
