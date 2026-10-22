// Motor puro del juego de dominó (sin React): baraja, reparto, reglas y IA de bots.

import type { GameState, PlacedTile, Side, Tile } from './types'
import { seatName } from './types'

/** Nombres por defecto de la mesa rápida */
const SEAT_NAMES_FALLBACK = ['Tú', 'Lola', 'Max', 'Kira'] as const

export const HAND_SIZE = 7

/** Las 28 fichas del dominó doble-seis */
export function createDeck(): Tile[] {
  const deck: Tile[] = []
  let id = 0
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      deck.push({ id: id++, a, b })
    }
  }
  return deck
}

function shuffle<T>(input: T[]): T[] {
  const arr = [...input]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Reparte 7 fichas a cada uno de los 4 asientos usando las 28 fichas */
export function dealHands(): Tile[][] {
  const deck = shuffle(createDeck())
  return [
    deck.slice(0, HAND_SIZE),
    deck.slice(HAND_SIZE, HAND_SIZE * 2),
    deck.slice(HAND_SIZE * 2, HAND_SIZE * 3),
    deck.slice(HAND_SIZE * 3, HAND_SIZE * 4),
  ]
}

/** Extremos actuales de la cadena (null si está vacía) */
export function getEnds(chain: PlacedTile[]): { left: number; right: number } | null {
  if (chain.length === 0) return null
  return { left: chain[0].left, right: chain[chain.length - 1].right }
}

/**
 * Lados donde la ficha puede colocarse.
 * Con cadena vacía devuelve ['right'] (irrelevante: además la primera jugada es obligatoria).
 */
export function sidesFor(tile: Tile, chain: PlacedTile[]): Side[] {
  const ends = getEnds(chain)
  if (!ends) return ['right']
  const sides: Side[] = []
  if (tile.a === ends.left || tile.b === ends.left) sides.push('left')
  if (tile.a === ends.right || tile.b === ends.right) sides.push('right')
  return sides
}

/** Orienta la ficha para encajar en el lado elegido de la cadena */
export function orientTile(tile: Tile, side: Side, chain: PlacedTile[]): PlacedTile {
  if (chain.length === 0) return { id: tile.id, left: tile.a, right: tile.b }
  const ends = getEnds(chain)!
  if (side === 'left') {
    // el valor derecho de la ficha colocada debe coincidir con el extremo izquierdo
    return tile.b === ends.left
      ? { id: tile.id, left: tile.a, right: tile.b }
      : { id: tile.id, left: tile.b, right: tile.a }
  }
  // el valor izquierdo de la ficha colocada debe coincidir con el extremo derecho
  return tile.a === ends.right
    ? { id: tile.id, left: tile.a, right: tile.b }
    : { id: tile.id, left: tile.b, right: tile.a }
}

export function pipSum(hand: Tile[]): number {
  return hand.reduce((sum, t) => sum + t.a + t.b, 0)
}

/** Busca el doble más alto repartido y a qué asiento pertenece */
function findHighestDouble(hands: Tile[][]): { seat: number; tile: Tile } | null {
  for (let d = 6; d >= 0; d--) {
    for (let seat = 0; seat < hands.length; seat++) {
      const tile = hands[seat].find((t) => t.a === d && t.b === d)
      if (tile) return { seat, tile }
    }
  }
  return null
}

/** Crea el estado inicial de una partida nueva (usa Math.random: llamar fuera de reducers).
 *  names: nombres reales por asiento (multijugador); si se omite, usa los de la mesa rápida. */
export function createGame(names?: string[]): GameState {
  const hands = dealHands()
  const seatLabel = (seat: number) => names?.[seat] ?? SEAT_NAMES_FALLBACK[seat]

  // Regla clásica: comienza quien tenga el doble más alto y juega esa ficha.
  // Como las 28 fichas siempre se reparten, los 7 dobles están en juego y el doble más alto existe.
  const start = findHighestDouble(hands)
  let starter = 0
  let requiredTile: Tile
  if (start) {
    starter = start.seat
    requiredTile = start.tile
  } else {
    // Salvaguarda inalcanzable en la práctica: mayor suma de puntos
    let best: Tile = hands[0][0]
    let bestSeat = 0
    for (let seat = 0; seat < hands.length; seat++) {
      for (const t of hands[seat]) {
        if (t.a + t.b > best.a + best.b) {
          best = t
          bestSeat = seat
        }
      }
    }
    starter = bestSeat
    requiredTile = best
  }

  let logSeq = 0
  const log: GameState['log'] = [
    {
      id: logSeq++,
      text: 'Nueva partida · 4 jugadores · el doble más alto abre la cadena',
      kind: 'system',
    },
    {
      id: logSeq++,
      text: `${seatLabel(starter)} tiene el doble más alto [${requiredTile.a}|${requiredTile.b}] y comienza la partida.`,
      kind: 'info',
    },
  ]

  return {
    hands,
    chain: [],
    turn: starter,
    starter,
    passesInRow: 0,
    phase: 'playing',
    outcome: null,
    requiredFirstTileId: requiredTile.id,
    lastSide: null,
    log,
    logSeq,
    names,
  }
}

export interface BotMove {
  tile: Tile
  side: Side
}

/**
 * IA de bot: si la cadena está vacía juega la ficha obligatoria; si no, elige entre las
 * fichas jugables priorizando dobles y fichas pesadas, y eligiendo el lado que le deja
 * el extremo conectado con más fichas propias restantes.
 */
export function chooseBotMove(
  hand: Tile[],
  chain: PlacedTile[],
  requiredTileId: number | null,
): BotMove | null {
  if (requiredTileId !== null) {
    const required = hand.find((t) => t.id === requiredTileId)
    if (required) return { tile: required, side: 'right' }
  }

  const options = hand
    .map((tile) => ({ tile, sides: sidesFor(tile, chain) }))
    .filter((o) => o.sides.length > 0)

  if (options.length === 0) return null

  const ends = getEnds(chain)!
  const scored = options.map(({ tile, sides }) => {
    let side: Side
    if (sides.length === 1) {
      side = sides[0]
    } else {
      const rest = hand.filter((t) => t.id !== tile.id)
      const countFor = (value: number) =>
        rest.filter((t) => t.a === value || t.b === value).length
      // si juega a la izquierda, el nuevo extremo izquierdo es tile.a; a la derecha, tile.b
      const leftReach = tile.b === ends.left ? countFor(tile.a) : countFor(tile.b)
      const rightReach = tile.a === ends.right ? countFor(tile.b) : countFor(tile.a)
      side = leftReach > rightReach ? 'left' : 'right'
    }
    const isDouble = tile.a === tile.b
    return { tile, side, score: (isDouble ? 10 : 0) + tile.a + tile.b }
  })

  scored.sort((x, y) => y.score - x.score)
  return { tile: scored[0].tile, side: scored[0].side }
}

/** Resuelve una mesa bloqueada: gana la mano más ligera; empate compartido entre los empatados */
export function resolveBlocked(state: GameState): GameState['outcome'] {
  const sums = state.hands.map(pipSum)
  const min = Math.min(...sums)
  const winners = sums.map((s, seat) => ({ s, seat })).filter((w) => w.s === min).map((w) => w.seat)

  const humanWins = winners.includes(0)
  const winnerLabel = winners.map((w) => seatName(state, w)).join(' y ')
  const message = humanWins
    ? `Mesa bloqueada. Tenías la mano más ligera (${sums[0]} puntos) y ganas la partida.`
    : `Mesa bloqueada. ${winnerLabel} tenía la mano más ligera y gana la partida.`

  return {
    type: humanWins ? 'blocked-win' : 'blocked-loss',
    winnerSeat: winners[0],
    pipSums: sums,
    message,
  }
}
