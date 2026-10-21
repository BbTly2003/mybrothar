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

const OUTCOME_LABEL: Record<ProfileData['recentGames'][number]['outcome'], { text: string; className: string }> = {
  win: { text: 'Ganada', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' },
  draw: { text: 'Bloqueada', className: 'bg-amber-500/15 text-amber-400 border-amber-500/40' },
  loss: { text: 'Perdida', className: 'bg-red-500/15 text-red-400 border-red-500/40' },
  forfeit: { text: 'Abandonada', className: 'bg-slate-500/15 text-slate-400 border-slate-500/40' },
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

export function Lobby({ profile, joiningStake, onJoin, onClaimBonus, bonusLoading }: LobbyProps) {
  const tokens = profile?.tokens ?? 0
  const needsBonus = profile !== null && tokens < 100

  return (
    <div className="space-y-6">
      <div className="text-center sm:text-left">
        <h2 className="text-xl font-bold text-slate-100 sm:text-2xl">Selecciona una mesa para jugar</h2>
        <p className="mt-1 text-sm text-slate-400">
          Elige tu apuesta. El ganador se lleva todo el pozo de la mesa (4 jugadores).
        </p>
      </div>

      {needsBonus && (
        <Card className="border-amber-500/40 bg-amber-950/40">
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
              className="min-h-11 w-full bg-amber-500 text-slate-950 hover:bg-amber-400 sm:w-auto"
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
                'group bg-slate-900 transition-all duration-200',
                affordable
                  ? 'border-slate-800 hover:-translate-y-1 hover:border-emerald-500 hover:shadow-[0_8px_24px_rgba(16,185,129,0.15)]'
                  : 'border-slate-800/60 opacity-70',
              )}
            >
              <CardContent className="flex h-full flex-col p-5 text-center">
                <div className="mb-2 text-3xl" aria-hidden>
                  {stake === 100 ? '🎲' : stake === 200 ? '🥉' : stake === 300 ? '🥈' : '👑'}
                </div>
                <h3 className="text-lg font-bold text-emerald-400">{meta.name}</h3>
                <p className="mt-0.5 text-xs text-slate-500">{meta.desc}</p>
                <p className="mt-3 text-sm text-slate-300">
                  Apuesta: <strong className="text-slate-100">{stake} tokens</strong>
                </p>
                <p className="mt-1 flex items-center justify-center gap-1 text-xs text-slate-500">
                  <Users className="h-3.5 w-3.5" aria-hidden />
                  Pozo: {stake * 4} tokens
                </p>
                <Button
                  onClick={() => onJoin(stake)}
                  disabled={!affordable || joiningStake !== null}
                  className="mt-4 min-h-11 w-full bg-emerald-600 font-bold hover:bg-emerald-500"
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
          <Card key={stat.label} className="border-slate-800 bg-slate-900">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-emerald-400">
                {stat.icon}
              </span>
              <div className="min-w-0">
                <p className="text-lg font-bold leading-tight text-slate-100">{stat.value}</p>
                <p className="truncate text-xs text-slate-500">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Historial reciente */}
      {profile && profile.recentGames.length > 0 && (
        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-300">
              <History className="h-4 w-4 text-slate-500" aria-hidden /> Últimas partidas
            </h3>
            <ul className="scrollbar-thin max-h-44 space-y-2 overflow-y-auto pr-1">
              {profile.recentGames.map((game) => {
                const label = OUTCOME_LABEL[game.outcome]
                return (
                  <li
                    key={game.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-800/70 bg-slate-950/60 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn('text-[11px]', label.className)}>
                        {label.text}
                      </Badge>
                      <span className="text-xs text-slate-500">{formatDate(game.createdAt)}</span>
                    </div>
                    <span
                      className={cn(
                        'text-sm font-bold',
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
