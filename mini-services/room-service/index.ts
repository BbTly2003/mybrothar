// MyBrothar · Servicio de salas multijugador local (WiFi) para 4 jugadores.
// Autoritativo: guarda el estado real de cada sala, valida cada jugada con el
// MISMO reducer que la mesa rápida (import compartido) y envía a cada jugador
// una vista rotada donde él siempre es el asiento 0 (abajo).
//
// BOTS en la sala: si no se llenan los 4 asientos con personas, el anfitrión
// puede añadir bots (o dejar que se rellenen solos al empezar). Los bots juegan
// con la MISMA IA de la mesa rápida (chooseBotMove) y su asiento cuenta igual
// para los equipos.
//
// Modo PAREJAS (equipos): el anfitrión elige compañero y puntos objetivo.
//  · Cada mano: el equipo ganador suma los puntos (pips) que quedaron en las
//    manos de los rivales — las fichas que quedaron fuera de la mesa.
//  · Tranca (nadie puede jugar): gana el equipo con MENOS puntos en mano y
//    suma los de los rivales; empate → gana el equipo que abrió la mano.
//  · La pareja ganadora abre la siguiente mano (alternando sus dos miembros);
//    solo la primera mano la abre el doble más alto.
//  · Gana el partido el primer equipo que alcance los puntos objetivo.
import { createServer } from 'http'
import { Server } from 'socket.io'
import type { GameState, RoomConfig, Side } from '../../src/lib/game/types'
import { chooseBotMove, createGame, pipSum, sidesFor } from '../../src/lib/game/engine'
import { gameReducer } from '../../src/lib/game/reducer'

const PORT = 3003
/** Pausa entre manos para ver el resumen de puntos (ms) */
const HAND_GAP_MS = 8000
const POINT_TARGETS: readonly number[] = [50, 100, 150, 200]

interface RoomPlayer {
  socketId: string
  name: string
  seat: number
  /** 'bot' = jugado por la IA (sin socket); 'human' = jugador real conectado */
  kind: 'human' | 'bot'
}

interface Match {
  mode: 'teams'
  targetPoints: number
  /** Asientos absolutos: teams[0] = equipo del anfitrión, teams[1] = rivales */
  teams: [number[], number[]]
  scores: [number, number]
  /** Próximo abridor por equipo (alterna entre los dos miembros) */
  teamNextOpener: [number, number]
  /** Quién abrió la mano actual (desempate en tranca) */
  openerSeat: number
  handNo: number
  over: boolean
  lastHand: { winnerTeam: 0 | 1; points: number; reason: 'domino' | 'blocked' } | null
  nextHandAt: number | null
}

interface Room {
  code: string
  hostSeat: number
  players: RoomPlayer[]
  state: GameState | null
  watchTimer: ReturnType<typeof setTimeout> | null
  config: RoomConfig
  match: Match | null
  nextHandTimer: ReturnType<typeof setTimeout> | null
  botTimer: ReturnType<typeof setTimeout> | null
}

/** socketId → sala y asiento de cada cliente conectado */
const seatOf = new Map<string, { code: string; seat: number }>()
const rooms = new Map<string, Room>()

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Nombre del bot según el asiento que ocupa (mismo elenco que la mesa rápida) */
const BOT_NAME_BY_SEAT = ['Tú', 'Lola', 'Max', 'Kira'] as const

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

/** Primer asiento libre (0-3) o -1 si la sala está llena */
function firstEmptySeat(room: Room): number {
  const taken = new Set(room.players.map((p) => p.seat))
  for (let s = 0; s < 4; s++) if (!taken.has(s)) return s
  return -1
}

/** Añade un bot al asiento indicado (o al primero libre) */
function addBot(room: Room, seat?: number): boolean {
  if (room.players.length >= 4) return false
  const s = typeof seat === 'number' ? seat : firstEmptySeat(room)
  if (s < 0 || s > 3 || room.players.some((p) => p.seat === s)) return false
  room.players.push({
    socketId: `bot:${room.code}:${s}`,
    name: BOT_NAME_BY_SEAT[s],
    seat: s,
    kind: 'bot',
  })
  return true
}

/** Reordena asientos tras salir/quitar a alguien: ajusta compañero, compacta,
 *  renombra los bots según su nuevo asiento y reasigna el anfitrión si hizo falta. */
function compactRoom(room: Room, leaverSeat: number) {
  if (room.config.partnerSeat !== null) {
    if (room.config.partnerSeat === leaverSeat) room.config.partnerSeat = null
    else if (room.config.partnerSeat > leaverSeat) room.config.partnerSeat -= 1
  }
  room.players.sort((a, b) => a.seat - b.seat)
  room.players.forEach((p, i) => {
    p.seat = i
    if (p.kind === 'bot') p.name = BOT_NAME_BY_SEAT[i]
    else seatOf.set(p.socketId, { code: room.code, seat: i })
  })
  if (!room.players.some((p) => p.seat === room.hostSeat)) room.hostSeat = 0
  broadcastLobby(room)
}

/** Equipos absolutos según la config actual (para el lobby) */
function configTeams(config: RoomConfig): [number[], number[]] | null {
  if (config.mode !== 'teams' || config.partnerSeat === null) return null
  const rest = [1, 2, 3].filter((s) => s !== config.partnerSeat)
  return [
    [0, config.partnerSeat],
    rest,
  ]
}

/** Equipo (0|1) al que pertenece un asiento absoluto */
function teamOfSeat(match: Match, seat: number): 0 | 1 {
  return match.teams[0].includes(seat) ? 0 : 1
}

/** Calcula el resultado de la mano terminada y actualiza el marcador.
 *  Reglas: dominó → el equipo del ganador suma los pips de las manos rivales.
 *  Tranca → gana el equipo con menos pips en mano y suma los del rival;
 *  empate → gana el equipo que abrió la mano. */
function finishHand(room: Room, s: GameState) {
  const match = room.match
  if (!match) return
  let winnerTeam: 0 | 1
  let points: number
  let reason: 'domino' | 'blocked'

  if (s.outcome && s.outcome.winnerSeat !== null && !s.outcome.pipSums) {
    // dominó: alguien se quedó sin fichas
    reason = 'domino'
    winnerTeam = teamOfSeat(match, s.outcome.winnerSeat)
    const losers = winnerTeam === 0 ? match.teams[1] : match.teams[0]
    points = losers.reduce((sum, seat) => sum + pipSum(s.hands[seat]), 0)
  } else {
    // tranca: suma por equipos
    reason = 'blocked'
    const sum0 = match.teams[0].reduce((sum, seat) => sum + pipSum(s.hands[seat]), 0)
    const sum1 = match.teams[1].reduce((sum, seat) => sum + pipSum(s.hands[seat]), 0)
    if (sum0 < sum1) {
      winnerTeam = 0
      points = sum1
    } else if (sum1 < sum0) {
      winnerTeam = 1
      points = sum0
    } else {
      winnerTeam = teamOfSeat(match, match.openerSeat)
      points = winnerTeam === 0 ? sum1 : sum0
    }
  }

  match.scores[winnerTeam] += points
  match.lastHand = { winnerTeam, points, reason }
  match.over = match.scores[winnerTeam] >= match.targetPoints
  console.log(
    `[room] ${room.code} mano ${match.handNo}: +${points} al equipo ${winnerTeam + 1} (${reason}) · marcador ${match.scores[0]}-${match.scores[1]}${match.over ? ' · PARTIDO TERMINADO' : ''}`,
  )
}

/** matchInfo rotado para el asiento receptor: teams[0] SIEMPRE es su equipo */
function matchInfoFor(room: Room, seat: number, s: GameState) {
  const match = room.match
  if (!match || match.mode !== 'teams') return null
  const rot = (n: number) => (n - seat + 4) % 4

  const rotTeams: [number[], number[]] = [
    match.teams[0].map(rot),
    match.teams[1].map(rot),
  ]
  const myIdx: 0 | 1 = rotTeams[0].includes(0) ? 0 : 1
  const teams: [number[], number[]] = myIdx === 0 ? rotTeams : [rotTeams[1], rotTeams[0]]
  const scores: [number, number] =
    myIdx === 0 ? [match.scores[0], match.scores[1]] : [match.scores[1], match.scores[0]]
  const handPoints = match.lastHand
    ? {
        winnerTeam: (myIdx === 0
          ? match.lastHand.winnerTeam
          : match.lastHand.winnerTeam === 0
            ? 1
            : 0) as 0 | 1,
        points: match.lastHand.points,
        reason: match.lastHand.reason,
      }
    : null
  const nextHandIn =
    s.phase === 'finished' && !match.over && match.nextHandAt
      ? Math.max(0, match.nextHandAt - Date.now())
      : 0

  return {
    mode: 'teams' as const,
    targetPoints: match.targetPoints,
    teams,
    scores,
    handPoints,
    matchOver: match.over,
    nextHandIn,
  }
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
    match: matchInfoFor(room, seat, s),
  }
}

function lobbyPayload(room: Room, seat: number) {
  return {
    code: room.code,
    mySeat: seat,
    isHost: room.hostSeat === seat,
    players: room.players.map((p) => p.name),
    kinds: room.players.map((p) => p.kind),
    hostSeat: room.hostSeat,
    phase: room.state ? ('playing' as const) : ('lobby' as const),
    config: room.config,
    teams: configTeams(room.config),
  }
}

function broadcastLobby(room: Room) {
  for (const p of room.players) {
    if (p.kind === 'bot') continue
    io.to(p.socketId).emit('lobby:state', lobbyPayload(room, p.seat))
  }
}

function broadcastViews(room: Room) {
  if (!room.state) return
  for (const p of room.players) {
    if (p.kind === 'bot') continue
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
  if (!next || next === before) return // jugada inválida: el estado real no cambia
  room.state = next

  if (next.phase === 'finished' && room.match?.mode === 'teams' && !room.match.over) {
    // modo parejas: puntúa la mano y prepara la siguiente
    finishHand(room, next)
    if (!room.match.over) {
      room.match.nextHandAt = Date.now() + HAND_GAP_MS
      broadcastViews(room)
      scheduleNextHand(room)
      return
    }
    broadcastViews(room)
    return
  }

  broadcastViews(room)
  scheduleTurnWatch(room)
  scheduleBotMove(room)
}

/** Arranca la siguiente mano: abre la pareja ganadora (miembro alternado) */
function startNextHand(room: Room) {
  const match = room.match
  if (!match || match.over || !room.state) return
  if (room.nextHandTimer) {
    clearTimeout(room.nextHandTimer)
    room.nextHandTimer = null
  }
  if (room.botTimer) {
    clearTimeout(room.botTimer)
    room.botTimer = null
  }
  if (room.state.phase !== 'finished') return

  const w = match.lastHand?.winnerTeam ?? 0
  const opener = match.teamNextOpener[w]
  match.teamNextOpener[w] = match.teams[w].find((s) => s !== opener) ?? opener
  match.openerSeat = opener
  match.handNo += 1
  match.nextHandAt = null

  room.state = createGame(room.players.map((p) => p.name), { starter: opener })
  broadcastViews(room)
  scheduleTurnWatch(room)
  scheduleBotMove(room)
  console.log(`[room] ${room.code} nueva mano ${match.handNo} · abre ${room.state.names?.[opener]}`)
}

/** Si le toca a un bot, piensa (pausa realista) y juega o pasa */
function scheduleBotMove(room: Room) {
  const s = room.state
  if (!s || s.phase !== 'playing') return
  const seat = s.turn
  const p = room.players.find((pl) => pl.seat === seat)
  if (!p || p.kind !== 'bot') return
  if (room.botTimer) clearTimeout(room.botTimer)
  room.botTimer = setTimeout(() => {
    if (room.botTimer) {
      clearTimeout(room.botTimer)
      room.botTimer = null
    }
    const cur = room.state
    if (!cur || cur.phase !== 'playing' || cur.turn !== seat) return
    const move = chooseBotMove(cur.hands[seat], cur.chain, cur.requiredFirstTileId)
    if (move) {
      applyServerAction(room, { player: seat, tileId: move.tile.id, side: move.side })
    } else {
      applyServerAction(room, { player: seat, pass: true })
    }
  }, 850 + Math.random() * 950)
}

/** Pausa entre manos: muestra el resumen de puntos y reparte de nuevo */
function scheduleNextHand(room: Room) {
  if (room.nextHandTimer) clearTimeout(room.nextHandTimer)
  room.nextHandTimer = setTimeout(() => startNextHand(room), HAND_GAP_MS)
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
  if (room.nextHandTimer) clearTimeout(room.nextHandTimer)
  if (room.botTimer) clearTimeout(room.botTimer)
  for (const p of room.players) {
    if (p.kind === 'bot') continue
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
  if (!player || player.kind === 'bot') return // los bots no se van solos
  const leaverSeat = player.seat
  room.players = room.players.filter((p) => p.socketId !== socketId)

  if (room.players.length === 0) {
    rooms.delete(room.code)
    return
  }

  // durante la partida no hay reemplazos: se cierra para todos
  if (room.state) {
    closeRoom(room, `${player.name} abandonó la partida.`)
    return
  }

  // en sala: compacta asientos (los bots se reacomodan solos)
  compactRoom(room, leaverSeat)
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
      players: [{ socketId: socket.id, name: cleanName(data?.name, 'Jugador 1'), seat: 0, kind: 'human' }],
      state: null,
      watchTimer: null,
      config: { mode: 'teams', partnerSeat: 2, targetPoints: 100 },
      match: null,
      nextHandTimer: null,
      botTimer: null,
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
    room.players.push({ socketId: socket.id, name: cleanName(data?.name, `Jugador ${seat + 1}`), seat, kind: 'human' })
    seatOf.set(socket.id, { code: room.code, seat })
    ack?.({ ok: true })
    broadcastLobby(room)
    console.log(`[room] ${room.players[seat].name} entró a ${room.code} (${room.players.length}/4)`)
  })

  // configuración del anfitrión: modo, compañero y puntos objetivo
  socket.on(
    'lobby:config',
    (
      data: { mode?: string; partnerSeat?: number | null; targetPoints?: number },
      ack?: (r: unknown) => void,
    ) => {
      const info = seatOf.get(socket.id)
      const room = info ? rooms.get(info.code) : null
      if (!room || !info) {
        ack?.({ ok: false, error: 'No estás en ninguna sala.' })
        return
      }
      if (room.hostSeat !== info.seat) {
        ack?.({ ok: false, error: 'Solo el anfitrión puede configurar la partida.' })
        return
      }
      if (room.state) {
        ack?.({ ok: false, error: 'La partida ya empezó.' })
        return
      }
      if (data?.mode === 'classic' || data?.mode === 'teams') room.config.mode = data.mode
      if (typeof data?.targetPoints === 'number' && POINT_TARGETS.includes(data.targetPoints)) {
        room.config.targetPoints = data.targetPoints
      }
      // el compañero puede ser un asiento aún vacío: se reservará para un bot
      if (data?.partnerSeat === null) {
        room.config.partnerSeat = null
      } else if (typeof data?.partnerSeat === 'number') {
        const ps = data.partnerSeat
        if (ps > 0 && ps < 4) room.config.partnerSeat = ps
      }
      ack?.({ ok: true })
      broadcastLobby(room)
    },
  )

  socket.on('lobby:leave', () => leaveRoom(socket.id))

  // añadir un bot al primer asiento libre (solo anfitrión, solo en sala)
  socket.on('lobby:addBot', (ack?: (r: unknown) => void) => {
    const info = seatOf.get(socket.id)
    const room = info ? rooms.get(info.code) : null
    if (!room || !info) {
      ack?.({ ok: false, error: 'No estás en ninguna sala.' })
      return
    }
    if (room.hostSeat !== info.seat) {
      ack?.({ ok: false, error: 'Solo el anfitrión puede añadir bots.' })
      return
    }
    if (room.state) {
      ack?.({ ok: false, error: 'La partida ya empezó.' })
      return
    }
    if (!addBot(room)) {
      ack?.({ ok: false, error: 'La sala está llena (4/4).' })
      return
    }
    const bot = room.players[room.players.length - 1]
    ack?.({ ok: true })
    broadcastLobby(room)
    console.log(`[room] ${bot.name} (bot) entró a ${room.code} (${room.players.length}/4)`)
  })

  // quitar el bot de un asiento (o el último si no se indica)
  socket.on('lobby:removeBot', (data: { seat?: number }, ack?: (r: unknown) => void) => {
    const info = seatOf.get(socket.id)
    const room = info ? rooms.get(info.code) : null
    if (!room || !info) {
      ack?.({ ok: false, error: 'No estás en ninguna sala.' })
      return
    }
    if (room.hostSeat !== info.seat) {
      ack?.({ ok: false, error: 'Solo el anfitrión puede quitar bots.' })
      return
    }
    if (room.state) {
      ack?.({ ok: false, error: 'La partida ya empezó.' })
      return
    }
    const bots = room.players.filter((p) => p.kind === 'bot')
    const bot =
      bots.find((p) => p.seat === data?.seat) ?? bots[bots.length - 1] ?? null
    if (!bot) {
      ack?.({ ok: false, error: 'No hay bots en la sala.' })
      return
    }
    room.players = room.players.filter((p) => p !== bot)
    compactRoom(room, bot.seat)
    ack?.({ ok: true })
    console.log(`[room] ${bot.name} (bot) salió de ${room.code} (${room.players.length}/4)`)
  })

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
    // los asientos que faltan se llenan con bots (la sala siempre arranca 4/4)
    while (room.players.length < 4) {
      if (!addBot(room)) break
    }
    const names = room.players.map((p) => p.name)

    if (room.config.mode === 'teams') {
      const partner = room.config.partnerSeat
      if (partner === null) {
        ack?.({ ok: false, error: 'Elige a tu compañero antes de empezar.' })
        return
      }
      const rivals = [1, 2, 3].filter((s) => s !== partner)
      room.match = {
        mode: 'teams',
        targetPoints: room.config.targetPoints,
        teams: [
          [0, partner],
          rivals,
        ],
        scores: [0, 0],
        teamNextOpener: [0, rivals[0]],
        openerSeat: -1,
        handNo: 1,
        over: false,
        lastHand: null,
        nextHandAt: null,
      }
      room.state = createGame(names)
    } else {
      room.match = null
      room.state = createGame(names)
    }

    ack?.({ ok: true })
    broadcastViews(room)
    scheduleTurnWatch(room)
    scheduleBotMove(room)
    console.log(
      `[room] partida iniciada en ${room.code} (modo ${room.config.mode}; ` +
        `${room.players.filter((p) => p.kind === 'human').length} humanos + ${room.players.filter((p) => p.kind === 'bot').length} bots)`,
    )
  })

  socket.on(
    'game:action',
    (data: { kind?: 'play' | 'pass'; tileId?: number; side?: Side }) => {
      const info = seatOf.get(socket.id)
      const room = info ? rooms.get(info.code) : null
      if (!info || !room || !room.state) return
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
    const names = room.players.map((p) => p.name)
    if (room.match?.mode === 'teams') {
      // nuevo partido: marcador a cero y primera mano con doble más alto
      const match = room.match
      match.scores = [0, 0]
      match.over = false
      match.lastHand = null
      match.nextHandAt = null
      match.handNo = 1
      match.openerSeat = -1
      match.teamNextOpener = [match.teams[0][0], match.teams[1][0]]
      if (room.nextHandTimer) {
        clearTimeout(room.nextHandTimer)
        room.nextHandTimer = null
      }
      room.state = createGame(names)
    } else {
      room.state = createGame(names)
    }
    ack?.({ ok: true })
    broadcastViews(room)
    scheduleTurnWatch(room)
    scheduleBotMove(room)
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

// bun --hot re-ejecuta este módulo al editar: cierra el servidor anterior para
// no chocar con el puerto y evitar que la recarga muera en silencio.
const hot = globalThis as typeof globalThis & { __roomHttpServer?: ReturnType<typeof createServer> }
if (hot.__roomHttpServer) hot.__roomHttpServer.close()
hot.__roomHttpServer = httpServer

httpServer.listen(PORT, () => {
  console.log(`MyBrothar room-service (multijugador WiFi) en puerto ${PORT}`)
})

process.on('SIGTERM', () => {
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  httpServer.close(() => process.exit(0))
})
