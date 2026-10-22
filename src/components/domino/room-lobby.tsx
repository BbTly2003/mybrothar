'use client'

import { useState } from 'react'
import { Check, Copy, Crown, Loader2, LogOut, Play, Users, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface LobbyState {
  code: string
  players: string[]
  isHost: boolean
  mySeat: number
}

export interface RoomLobbyProps {
  screen: 'entry' | 'room'
  connected: boolean
  busy: boolean
  name: string
  onNameChange: (v: string) => void
  joinCode: string
  onJoinCodeChange: (v: string) => void
  onCreate: () => void
  onJoin: () => void
  /** sala ya creada/entrada */
  lobby: LobbyState | null
  onStart: () => void
  onLeave: () => void
  error: string | null
}

/**
 * Sala de juego multijugador (WiFi local): crear sala o unirse con código,
 * lista de los 4 asientos y arranque por el anfitrión. Vive sobre el panel
 * de la mesa, sustituyendo a la intro cinematográfica.
 */
export function RoomLobby(props: RoomLobbyProps) {
  const { screen, connected, busy, name, onNameChange, joinCode, onJoinCodeChange, onCreate, onJoin, lobby, onStart, onLeave, error } = props
  const [copied, setCopied] = useState(false)

  const copyCode = async () => {
    if (!lobby) return
    try {
      await navigator.clipboard.writeText(lobby.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* portapapeles no disponible: el código sigue visible */
    }
  }

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-black/62 p-4 shadow-2xl backdrop-blur-md sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-black text-white sm:text-lg">
            <Users className="h-5 w-5 text-emerald-400" aria-hidden />
            {screen === 'room' ? 'Sala de juego' : 'Multijugador'}
          </h2>
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold',
              connected ? 'bg-emerald-400/15 text-emerald-300' : 'bg-red-400/15 text-red-300',
            )}
            role="status"
          >
            {connected ? <Wifi className="h-3 w-3" aria-hidden /> : <WifiOff className="h-3 w-3" aria-hidden />}
            {connected ? 'WiFi listo' : 'Conectando…'}
          </span>
        </div>

        {screen === 'entry' ? (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-zinc-400">
              Juega una partida real entre 4 personas en la misma red WiFi: una crea la sala
              y las demás se unen con el código.
            </p>
            <div>
              <label htmlFor="lobby-name" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                Tu nombre
              </label>
              <Input
                id="lobby-name"
                value={name}
                onChange={(e) => onNameChange(e.target.value.slice(0, 14))}
                placeholder="Ej. Juan"
                maxLength={14}
                className="h-11 border-white/15 bg-black/40 text-white placeholder:text-zinc-600"
              />
            </div>
            <Button
              onClick={onCreate}
              disabled={busy || !connected}
              className="min-h-11 w-full bg-emerald-600 text-sm font-black hover:bg-emerald-500"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Crear sala
            </Button>

            <div className="flex items-center gap-3 py-0.5" aria-hidden>
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">o únete</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="flex gap-2">
              <Input
                value={joinCode}
                onChange={(e) => onJoinCodeChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
                placeholder="CÓDIGO"
                maxLength={4}
                aria-label="Código de la sala"
                className="h-11 flex-1 border-white/15 bg-black/40 text-center font-mono text-lg font-black uppercase tracking-[0.3em] text-white placeholder:tracking-normal placeholder:text-zinc-600"
              />
              <Button
                onClick={onJoin}
                disabled={busy || !connected || joinCode.length < 4}
                className="min-h-11 w-24 bg-white/10 text-sm font-black text-emerald-300 hover:bg-white/15"
              >
                Unirse
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {lobby && (
              <>
                <button
                  onClick={copyCode}
                  className="group flex w-full flex-col items-center rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-3 transition-colors hover:bg-emerald-400/15"
                  aria-label={`Código de la sala: ${lobby.code}. Toca para copiar`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300/80">
                    Código de la sala
                  </span>
                  <span className="flex items-center gap-2 font-mono text-3xl font-black tracking-[0.35em] text-emerald-300">
                    {lobby.code}
                    {copied ? (
                      <Check className="h-4 w-4" aria-hidden />
                    ) : (
                      <Copy className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-60" aria-hidden />
                    )}
                  </span>
                </button>
                <p className="text-center text-[11px] text-zinc-400">
                  Comparte el código: los demás lo escriben en «Multijugador» desde su móvil.
                </p>

                <ul className="space-y-1.5" aria-label="Jugadores en la sala">
                  {Array.from({ length: 4 }).map((_, i) => {
                    const name = lobby.players[i]
                    return (
                      <li
                        key={i}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm font-bold',
                          name
                            ? 'border-white/10 bg-white/5 text-white'
                            : 'border-dashed border-white/10 text-zinc-600',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-full text-xs',
                            name ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/5',
                          )}
                          aria-hidden
                        >
                          {name ? (i === 0 ? '😎' : i === 1 ? '🐼' : i === 2 ? '🦊' : '🐯') : '?'}
                        </span>
                        {name ? (
                          <>
                            <span className="min-w-0 truncate">{name}</span>
                            {i === 0 && (
                              <span className="ml-auto flex items-center gap-1 text-[10px] font-black uppercase text-amber-300">
                                <Crown className="h-3.5 w-3.5" aria-hidden /> Anfitrión
                              </span>
                            )}
                          </>
                        ) : (
                          <span>Esperando jugador…</span>
                        )}
                      </li>
                    )
                  })}
                </ul>

                {lobby.isHost ? (
                  <>
                    <Button
                      onClick={onStart}
                      disabled={lobby.players.length < 4 || !connected}
                      className="min-h-11 w-full bg-emerald-600 text-sm font-black hover:bg-emerald-500"
                    >
                      <Play className="h-4 w-4" aria-hidden />
                      Empezar partida
                    </Button>
                    {lobby.players.length < 4 && (
                      <p className="text-center text-[11px] text-zinc-500">
                        Faltan {4 - lobby.players.length} jugador{4 - lobby.players.length === 1 ? '' : 'es'} para empezar.
                      </p>
                    )}
                  </>
                ) : (
                  <p
                    className="animate-pulse rounded-lg bg-white/5 px-3 py-2.5 text-center text-xs font-bold text-zinc-400"
                    role="status"
                  >
                    Esperando a que el anfitrión empiece…
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {error && (
          <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-center text-xs font-bold text-red-300" role="alert">
            {error}
          </p>
        )}

        <Button
          onClick={onLeave}
          variant="ghost"
          className="mt-2 min-h-9 w-full gap-1.5 text-xs text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          {screen === 'room' ? 'Salir de la sala' : 'Volver al menú'}
        </Button>
      </div>
    </div>
  )
}
