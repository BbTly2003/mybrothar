import { spawn, spawnSync } from 'child_process'
import { openSync, appendFileSync } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const ROOM_DIR = path.join(process.cwd(), 'mini-services', 'room-service')
const LOG_FILE = path.join(process.cwd(), 'room-service.log')

/**
 * Reinicia el room-service (servicio de salas multijugador, puerto 3003).
 * El proceso se lanza DESLIGADO del dev server (detached + unref) para que
 * sobreviva a la petición. Pensado para desarrollo: si el entorno mata el
 * servicio, este endpoint lo vuelve a levantar sin reiniciar todo el proyecto.
 */
export async function POST() {
  try {
    appendFileSync(LOG_FILE, `\n[restart] reinicio solicitado ${new Date().toISOString()}\n`)
  } catch {
    /* log no disponible: seguimos */
  }

  // 1) mata instancias previas del servicio (por su línea de comando concreta)
  spawnSync('pkill', ['-f', 'bun --hot index.ts'], { stdio: 'ignore' })
  spawnSync('pkill', ['-f', 'bun index.ts'], { stdio: 'ignore' })
  await new Promise((r) => setTimeout(r, 500))

  // 2) arranca una instancia nueva, desligada y con log propio
  const logFd = openSync(LOG_FILE, 'a')
  const child = spawn('bun', ['--hot', 'index.ts'], {
    cwd: ROOM_DIR,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: process.env,
  })
  child.unref()

  return Response.json({ ok: true, pid: child.pid })
}
