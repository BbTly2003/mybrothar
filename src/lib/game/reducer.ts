// Reducer puro del juego. Las acciones con aleatoriedad (crear partida) se preparan fuera.

import type { GameState, Side } from './types'
import { seatName } from './types'
import { chooseBotMove, orientTile, resolveBlocked, sidesFor } from './engine'

export type GameAction =
  | { type: 'SET_GAME'; state: GameState }
  | { type: 'APPLY_PLAY'; player: number; tileId: number; side: Side }
  | { type: 'APPLY_PASS'; player: number }
  | { type: 'RESET' }

function addLog(state: GameState, text: string, kind: GameState['log'][number]['kind']): Pick<GameState, 'log' | 'logSeq'> {
  const entry = { id: state.logSeq, text, kind }
  return { log: [entry, ...state.log].slice(0, 60), logSeq: state.logSeq + 1 }
}

export function gameReducer(state: GameState | null, action: GameAction): GameState | null {
  switch (action.type) {
    case 'SET_GAME':
      return action.state

    case 'RESET':
      return null

    case 'APPLY_PLAY': {
      if (!state || state.phase !== 'playing') return state
      const { player, tileId, side } = action

      const hand = state.hands[player]
      const tile = hand.find((t) => t.id === tileId)
      if (!tile) return state

      // Validación defensiva: si la cadena está vacía solo vale la ficha obligatoria;
      // en el resto de casos la ficha debe encajar en el lado declarado.
      if (state.chain.length === 0) {
        if (state.requiredFirstTileId !== null && tileId !== state.requiredFirstTileId) return state
      } else if (!sidesFor(tile, state.chain).includes(side)) {
        return state
      }

      const placed = orientTile(tile, side, state.chain)
      const chain =
        state.chain.length === 0
          ? [placed]
          : side === 'left'
            ? [placed, ...state.chain]
            : [...state.chain, placed]

      const hands = state.hands.map((h, i) => (i === player ? h.filter((t) => t.id !== tileId) : h))

      const playedLabel = `[${tile.a}|${tile.b}]`
      const { log, logSeq } = addLog(state, `${seatName(state, player)} jugó ${playedLabel}.`, 'play')

      // ¿Fin por quedarse sin fichas?
      if (hands[player].length === 0) {
        const humanWon = player === 0
        const outcome: GameState['outcome'] = humanWon
          ? {
              type: 'win',
              winnerSeat: 0,
              message: '¡Te quedaste sin fichas! Ganaste la partida.',
            }
          : {
              type: 'loss',
              winnerSeat: player,
              message: `${seatName(state, player)} se quedó sin fichas y gana la partida.`,
            }
        return {
          ...state,
          hands,
          chain,
          phase: 'finished',
          outcome: { ...outcome },
          requiredFirstTileId: null,
          passesInRow: 0,
          lastSide: side,
          log: [outcomeLogEntry(state.logSeq, outcome, humanWon), ...state.log],
          logSeq: state.logSeq + 1,
        }
      }

      return {
        ...state,
        hands,
        chain,
        // El turno pasa SIEMPRE al jugador de la DERECHA del que acaba de jugar
        // (asientos: 0=Tú abajo, 1=Lola izq, 2=Max frente, 3=Kira der):
        // Tú → Kira → Max → Lola → Tú
        turn: (player + 3) % 4,
        requiredFirstTileId: null,
        passesInRow: 0,
        lastSide: side,
        log,
        logSeq,
      }
    }

    case 'APPLY_PASS': {
      if (!state || state.phase !== 'playing') return state
      const { player } = action

      // Validación defensiva: nadie puede pasar teniendo jugada disponible
      const hasMove = state.hands[player].some((t) => sidesFor(t, state.chain).length > 0)
      if (state.chain.length > 0 && hasMove) return state

      const passesInRow = state.passesInRow + 1
      const { log, logSeq } = addLog(state, `${seatName(state, player)} pasa su turno.`, 'pass')

      // Mesa bloqueada: 4 pases consecutivos
      if (passesInRow >= 4) {
        const outcome = resolveBlocked({ ...state, passesInRow })
        return {
          ...state,
          phase: 'finished',
          outcome,
          passesInRow,
          log: [outcomeLogEntry(state.logSeq, outcome, outcome.type === 'blocked-win'), ...state.log],
          logSeq: state.logSeq + 1,
        }
      }

      return {
        ...state,
        passesInRow,
        // El turno pasa SIEMPRE al jugador de la DERECHA (mismo sentido que APPLY_PLAY)
        turn: (player + 3) % 4,
        log,
        logSeq,
      }
    }

    default:
      return state
  }
}

function outcomeLogEntry(
  id: number,
  outcome: NonNullable<GameState['outcome']>,
  humanWon: boolean,
): GameState['log'][number] {
  return {
    id,
    text: humanWon ? '🏆 Ganaste la partida.' : `💀 ${outcome.message}`,
    kind: humanWon ? 'win' : 'lose',
  }
}

export { chooseBotMove }
