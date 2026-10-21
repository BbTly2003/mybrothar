'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Coins, Gift, History, Loader2, Trophy, Users } from 'lucide-react'
import { TABLE_META, STAKES, type Stake } from '@/lib/game/types'
import { cn } from '@/lib/utils'

export interface ProfileData {
  tokens: number
  stats: { gamesPlayed: number; gamesWon: number; tokensWon: number }
  recentGames: Array<{
    id: number
    stake: number
    pot: number
    outcome: 'win' | 'loss' | 'draw' | 'forfeit'
    payout: number
    createdAt: string
  }>
}

interface LobbyProps {
  profile: ProfileData | null
  joiningStake: Stake | null
  onJoin: (stake: Stake) => void
  onClaimBonus: () => void
  bonusLoading: boolean
}

const STAKE_EMOJI: Record<Stake, string> = {
  100: '🎲',
  200: '🥉',
  300: '🥈',
  500: '👑',
}

const OUTCOME_LABEL: Record<ProfileData['recentGames'][number]['outcome'], { text: string; className: string }> = {
  win: { text: 'Ganada', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' },
  draw: { text: 'Bloqueada', className: 'bg-amber-500/15 text-amber-400 border-amber-500/40' },
  loss: { text: 'Perdida', className: 'bg-red-500/15 text-red-400 border-red-500/40' },
  forfeit: { text: 'Abandonada', className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/40' },
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

/** Mini mesa de fieltro estilo Plato para la tarjeta de cada sala */
function MiniTable({ stake }: { stake: Stake }) {
  return (
    <div
      className="plato-felt relative mx-auto mb-4 mt-1 h-24 w-full max-w-[190px] rounded-2xl border-4 border-emerald-800 shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
      aria-hidden
    >
      <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5">
        <span className="h-3.5 w-7 rounded-[3px] bg-gradient-to-b from-white to-stone-300 shadow" />
        <span className="h-7 w-3.5 rounded-[3px] bg-gradient-to-b from-white to-stone-300 shadow" />
        <span className="h-3.5 w-7 rounded-[3px] bg-gradient-to-b from-white to-stone-300 shadow" />
      </span>
      <span className="absolute -right-1.5 -top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-zinc-950 shadow-md">
        {stake * 4} 🪙
      </span>
      <span className="absolute -left-1.5 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-sm shadow-md">
        {STAKE_EMOJI[stake]}
      </span>
    </div>
  )
}

export function Lobby({ profile, joiningStake, onJoin, onClaimBonus, bonusLoading }: LobbyProps) {
  const tokens = profile?.tokens ?? 0
  const needsBonus = profile !== null && tokens < 100

  return (
    <div className="space-y-6">
      <div className="text-center sm:text-left">
        <h2 className="text-xl font-black text-zinc-100 sm:text-2xl">Selecciona una mesa para jugar</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Elige tu apuesta. El ganador se lleva todo el pozo de la mesa (4 jugadores).
        </p>
      </div>

      {needsBonus && (
        <Card className="rounded-2xl border-amber-500/40 bg-amber-950/40">
          <CardContent className="flex flex-col items-center justify-between gap-3 p-4 sm:flex-row">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <Gift className="h-8 w-8 shrink-0 text-amber-400" aria-hidden />
              <div>
                <p className="font-semibold text-amber-300">¿Sin tokens para jugar?</p>
                <p className="text-sm text-amber-200/70">Reclama 500 tokens gratis y sigue en la acción.</p>
              </div>
            </div>
            <Button
              onClick={onClaimBonus}
              disabled={bonusLoading}
              className="min-h-11 w-full bg-amber-500 text-zinc-950 hover:bg-amber-400 sm:w-auto"
            >
              {bonusLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
              Reclamar 500 tokens
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Cuadrícula de mesas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAKES.map((stake) => {
          const meta = TABLE_META[stake]
          const affordable = tokens >= stake
          const joining = joiningStake === stake
          return (
            <Card
              key={stake}
              className={cn(
                'group rounded-3xl bg-zinc-900 transition-all duration-200',
                affordable
                  ? 'border-zinc-800 hover:-translate-y-1 hover:border-emerald-500/70 hover:shadow-[0_12px_30px_rgba(16,185,129,0.18)]'
                  : 'border-zinc-800/60 opacity-70',
              )}
            >
              <CardContent className="flex h-full flex-col p-4 text-center">
                <MiniTable stake={stake} />
                <h3 className="text-lg font-black text-emerald-400">{meta.name}</h3>
                <p className="mt-0.5 text-xs text-zinc-500">{meta.desc}</p>
                <p className="mt-3 text-sm text-zinc-300">
                  Apuesta: <strong className="text-zinc-100">{stake} tokens</strong>
                </p>
                <p className="mt-1 flex items-center justify-center gap-1 text-xs text-zinc-500">
                  <Users className="h-3.5 w-3.5" aria-hidden />
                  Pozo: {stake * 4} tokens
                </p>
                <Button
                  onClick={() => onJoin(stake)}
                  disabled={!affordable || joiningStake !== null}
                  className="mt-4 min-h-11 w-full rounded-full bg-emerald-600 font-black hover:bg-emerald-500"
                >
                  {joining ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Entrando…
                    </>
                  ) : affordable ? (
                    'Entrar'
                  ) : (
                    'Fondos insuficientes'
                  )}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: <Users className="h-4 w-4" aria-hidden />, label: 'Partidas', value: profile?.stats.gamesPlayed ?? 0 },
          { icon: <Trophy className="h-4 w-4" aria-hidden />, label: 'Victorias', value: profile?.stats.gamesWon ?? 0 },
          { icon: <Coins className="h-4 w-4" aria-hidden />, label: 'Tokens ganados', value: profile?.stats.tokensWon ?? 0 },
        ].map((stat) => (
          <Card key={stat.label} className="rounded-2xl border-zinc-800 bg-zinc-900">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-emerald-400">
                {stat.icon}
              </span>
              <div className="min-w-0">
                <p className="text-lg font-black leading-tight text-zinc-100">{stat.value}</p>
                <p className="truncate text-xs text-zinc-500">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Historial reciente */}
      {profile && profile.recentGames.length > 0 && (
        <Card className="rounded-2xl border-zinc-800 bg-zinc-900">
          <CardContent className="p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-300">
              <History className="h-4 w-4 text-zinc-500" aria-hidden /> Últimas partidas
            </h3>
            <ul className="scrollbar-thin max-h-44 space-y-2 overflow-y-auto pr-1">
              {profile.recentGames.map((game) => {
                const label = OUTCOME_LABEL[game.outcome]
                return (
                  <li
                    key={game.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/70 bg-zinc-950/60 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn('text-[11px]', label.className)}>
                        {label.text}
                      </Badge>
                      <span className="text-xs text-zinc-500">{formatDate(game.createdAt)}</span>
                    </div>
                    <span
                      className={cn(
                        'text-sm font-black',
                        game.payout > 0 ? 'text-emerald-400' : 'text-red-400',
                      )}
                    >
                      {game.payout > 0 ? `+${game.payout}` : `-${game.stake}`} 🪙
                    </span>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
