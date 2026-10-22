// MyBrothar · Servicio de salas multijugador local (WiFi) para 4 jugadores.
// Autoritativo: guarda el estado real de cada sala, valida cada jugada con el
// MISMO reducer que la mesa rápida (import compartido) y envía a cada jugador
// una vista rotada donde él siempre es el asiento 0 (abajo).
import { createServer } from 'http'
import { Server } from 'socket.io'
import type { GameState, Side } from '../../src/lib/game/types'
import { createGame, sidesFor } from '../../src/lib/game/engine'
import { gameReducer } from '../../src/lib/game/reducer'

const PORT = 3003

interface RoomPlayer {
  socketId: string
  name: string
  seat: number
}

interface Room {
  code: string
  hostSeat: number
  players: RoomPlayer[]
  state: GameState | null
  watchTimer: ReturnType<typeof setTimeout> | null
}

/** socketId → sala y asiento de cada cliente conectado */
const seatOf = new Map<string, { code: string; seat: number }>()
const rooms = new Map<string, Room>()

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function makeCode(): string {
  let code = ''
  do {
    code = Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')
  } while (rooms.has(code))
  return code
}

function cleanName(raw: unknown, fallback: string): string {
  const name = typeof raw === 'string' ? raw.trim().slice(0, 14) : ''
  return name.length > 0 ? name : fallback
}

/** Vista personalizada: el receptor SIEMPRE es el asiento 0 (abajo) y las demás
 *  manos viajan vacías (solo sus conteos). La rotación preserva el orden de
 *  turno (player+3)%4, así el frontend no distingue multi de mesa rápida. */
function buildView(room: Room, seat: number) {
  const s = room.state
  if (!s) return null
  const k = seat
  const rot = (n: number) => (n - k + 4) % 4
  const rotArr = <T,>(arr: T[]): T[] => arr.map((_, i) => arr[(k + i) % 4])

  const names = rotArr(s.names ?? ['Jugador 1', 'Jugador 2', 'Jugador 3', 'Jugador 4'])
  const handCounts = rotArr(s.hands.map((h) => h.length))
  const hands = s.hands.map((_, i) => (i === 0 ? s.hands[k] : []))

  // resultado personalizado para el asiento que recibe la vista
  let outcome = s.outcome
  if (outcome) {
    if (outcome.winnerSeat !== null && !outcome.pipSums) {
      // fin por dominó: alguien se quedó sin fichas
      const myWin = outcome.winnerSeat === k
      const winnerRot = rot(outcome.winnerSeat)
      outcome = {
        type: myWin ? 'win' : 'loss',
        winnerSeat: winnerRot,
        message: myWin
          ? '¡Te quedaste sin fichas! Ganaste la partida.'
          : `${names[winnerRot]} se quedó sin fichas y gana la partida.`,
      }
    } else if (outcome.pipSums) {
      // mesa bloqueada: recalcula con las sumas rotadas
      const sums = rotArr(outcome.pipSums)
      const min = Math.min(...sums)
      const winners = sums.map((v, i) => ({ v, i })).filter((w) => w.v === min).map((w) => w.i)
      const myWin = winners.includes(0)
      outcome = {
        type: myWin ? 'blocked-win' : 'blocked-loss',
        winnerSeat: winners[0],
        pipSums: sums,
        message: myWin
          ? `Mesa bloqueada. Tenías la mano más ligera (${sums[0]} puntos) y ganas la partida.`
          : `Mesa bloqueada. ${winners.map((i) => names[i]).join(' y ')} tenía${
              winners.length > 1 ? 'n' : ''
            } la mano más ligera y gana${winners.length > 1 ? 'n' : ''} la partida.`,
      }
    }
  }

  // la primera entrada del log al terminar es el veredicto: personalízala
  const log = s.log.map((e, i) => {
    if (i === 0 && s.phase === 'finished' && (e.kind === 'win' || e.kind === 'lose') && outcome) {
      const iWon = outcome.type === 'win' || outcome.type === 'blocked-win'
      return { ...e, text: iWon ? '🏆 Ganaste la partida.' : `💀 ${outcome.message}` }
    }
    return e
  })

  return {
    state: { ...s, hands, turn: rot(s.turn), starter: rot(s.starter), outcome, log },
    handCounts,
    seatNames: names,
    code: room.code,
    isHost: room.hostSeat === seat,
  }
}

function lobbyPayload(room: Room, seat: number) {
  return {
    code: room.code,
    mySeat: seat,
    isHost: room.hostSeat === seat,
    players: room.players.map((p) => p.name),
    hostSeat: room.hostSeat,
    phase: room.state ? ('playing' as const) : ('lobby' as const),
  }
}

function broadcastLobby(room: Room) {
  for (const p of room.players) {
    io.to(p.socketId).emit('lobby:state', lobbyPayload(room, p.seat))
  }
}

function broadcastViews(room: Room) {
  if (!room.state) return
  for (const p of room.players) {
    const view = buildView(room, p.seat)
    if (view) io.to(p.socketId).emit('game:view', view)
  }
}

/** Reducer central: aplica la acción al estado real y retransmite si cambió */
function applyServerAction(
  room: Room,
  action: { player: number; tileId?: number; side?: Side; pass?: boolean },
) {
  const before = room.state
  if (!before || before.phase !== 'playing') return
  const next = action.pass
    ? gameReducer(before, { type: 'APPLY_PASS', player: action.player })
    : gameReducer(before, {
        type: 'APPLY_PLAY',
        player: action.player,
        tileId: action.tileId ?? -1,
        side: action.side ?? 'right',
      })
  if (next === before) return // jugada inválida: el estado real no cambia
  room.state = next
  broadcastViews(room)
  scheduleTurnWatch(room)
}

/** Red de seguridad: si al que le toca no tiene jugada y pasan 8s, pasa solo */
function scheduleTurnWatch(room: Room) {
  if (room.watchTimer) clearTimeout(room.watchTimer)
  const s = room.state
  if (!s || s.phase !== 'playing') return
  const seat = s.turn
  room.watchTimer = setTimeout(() => {
    const cur = room.state
    if (!cur || cur.phase !== 'playing' || cur.turn !== seat) return
    const hasMove = cur.hands[seat].some((t) => sidesFor(t, cur.chain).length > 0)
    if (cur.chain.length > 0 && !hasMove) {
      applyServerAction(room, { player: seat, pass: true })
    } else {
      scheduleTurnWatch(room) // tiene jugada: esperamos (vida real)
    }
  }, 8000)
}

function closeRoom(room: Room, reason: string) {
  if (room.watchTimer) clearTimeout(room.watchTimer)
  for (const p of room.players) {
    seatOf.delete(p.socketId)
    io.to(p.socketId).emit('room:closed', { reason })
  }
  rooms.delete(room.code)
}

function leaveRoom(socketId: string) {
  const info = seatOf.get(socketId)
  if (!info) return
  seatOf.delete(socketId)
  const room = rooms.get(info.code)
  if (!room) return

  const player = room.players.find((p) => p.socketId === socketId)
  room.players = room.players.filter((p) => p.socketId !== socketId)

  if (room.players.length === 0) {
    rooms.delete(room.code)
    return
  }

  // durante la partida no hay reemplazos: se cierra para todos
  if (room.state) {
    closeRoom(room, `${player?.name ?? 'Un jugador'} abandonó la partida.`)
    return
  }

  // en sala: compacta asientos y reasigna el anfitrión si hizo falta
  room.players.sort((a, b) => a.seat - b.seat)
  room.players.forEach((p, i) => {
    p.seat = i
    seatOf.set(p.socketId, { code: room.code, seat: i })
  })
  if (!room.players.some((p) => p.seat === room.hostSeat)) room.hostSeat = 0
  broadcastLobby(room)
}

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path: Caddy lo usa para reenviar al puerto correcto
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

io.on('connection', (socket) => {
  console.log(`[room] conectado: ${socket.id}`)

  socket.on('lobby:create', (data: { name?: string }, ack?: (r: unknown) => void) => {
    if (seatOf.has(socket.id)) leaveRoom(socket.id)
    const room: Room = {
      code: makeCode(),
      hostSeat: 0,
      players: [{ socketId: socket.id, name: cleanName(data?.name, 'Jugador 1'), seat: 0 }],
      state: null,
      watchTimer: null,
    }
    rooms.set(room.code, room)
    seatOf.set(socket.id, { code: room.code, seat: 0 })
    ack?.({ ok: true, code: room.code })
    broadcastLobby(room)
    console.log(`[room] sala ${room.code} creada por ${room.players[0].name}`)
  })

  socket.on('lobby:join', (data: { code?: string; name?: string }, ack?: (r: unknown) => void) => {
    const code = (typeof data?.code === 'string' ? data.code : '').trim().toUpperCase()
    const room = rooms.get(code)
    if (!room) {
      ack?.({ ok: false, error: 'No existe una sala con ese código.' })
      return
    }
    if (room.state) {
      ack?.({ ok: false, error: 'La partida ya empezó.' })
      return
    }
    if (room.players.length >= 4) {
      ack?.({ ok: false, error: 'La sala está llena (4/4).' })
      return
    }
    if (seatOf.has(socket.id)) leaveRoom(socket.id)
    const seat = room.players.length
    room.players.push({ socketId: socket.id, name: cleanName(data?.name, `Jugador ${seat + 1}`), seat })
    seatOf.set(socket.id, { code: room.code, seat })
    ack?.({ ok: true })
    broadcastLobby(room)
    console.log(`[room] ${room.players[seat].name} entró a ${room.code} (${room.players.length}/4)`)
  })

  socket.on('lobby:leave', () => leaveRoom(socket.id))

  socket.on('lobby:start', (ack?: (r: unknown) => void) => {
    const info = seatOf.get(socket.id)
    const room = info ? rooms.get(info.code) : null
    if (!room || !info) {
      ack?.({ ok: false, error: 'No estás en ninguna sala.' })
      return
    }
    if (room.hostSeat !== info.seat) {
      ack?.({ ok: false, error: 'Solo el anfitrión puede empezar.' })
      return
    }
    if (room.players.length !== 4) {
      ack?.({ ok: false, error: `Faltan jugadores (${room.players.length}/4).` })
      return
    }
    const names = room.players.map((p) => p.name)
    room.state = createGame(names)
    ack?.({ ok: true })
    broadcastViews(room)
    scheduleTurnWatch(room)
    console.log(`[room] partida iniciada en ${room.code}`)
  })

  socket.on(
    'game:action',
    (data: { kind?: 'play' | 'pass'; tileId?: number; side?: Side }) => {
      const info = seatOf.get(socket.id)
      const room = info ? rooms.get(info.code) : null
      if (!room || !room.state) return
      if (room.state.phase !== 'playing') return
      if (room.state.turn !== info.seat) return // no es tu turno: el estado manda
      if (data?.kind === 'pass') {
        applyServerAction(room, { player: info.seat, pass: true })
      } else if (data?.kind === 'play' && typeof data.tileId === 'number') {
        applyServerAction(room, {
          player: info.seat,
          tileId: data.tileId,
          side: data.side === 'left' ? 'left' : 'right',
        })
      }
    },
  )

  socket.on('game:rematch', (ack?: (r: unknown) => void) => {
    const info = seatOf.get(socket.id)
    const room = info ? rooms.get(info.code) : null
    if (!room || !info) {
      ack?.({ ok: false, error: 'No estás en ninguna sala.' })
      return
    }
    if (room.hostSeat !== info.seat) {
      ack?.({ ok: false, error: 'Solo el anfitrión puede dar revancha.' })
      return
    }
    if (!room.state || room.state.phase !== 'finished') {
      ack?.({ ok: false, error: 'La partida sigue en juego.' })
      return
    }
    room.state = createGame(room.players.map((p) => p.name))
    ack?.({ ok: true })
    broadcastViews(room)
    scheduleTurnWatch(room)
    console.log(`[room] revancha en ${room.code}`)
  })

  socket.on('disconnect', () => {
    console.log(`[room] desconectado: ${socket.id}`)
    leaveRoom(socket.id)
  })

  socket.on('error', (error) => {
    console.error(`[room] error (${socket.id}):`, error)
  })
})

httpServer.listen(PORT, () => {
  console.log(`MyBrothar room-service (multijugador WiFi) en puerto ${PORT}`)
})

process.on('SIGTERM', () => {
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  httpServer.close(() => process.exit(0))
})
