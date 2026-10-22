'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { GameOutcome } from '@/lib/game/types'
import { potFor } from '@/lib/game/engine'

interface ResultDialogProps {
  open: boolean
  outcome: GameOutcome | null
  stake: number
  canReplay: boolean
  replaying: boolean
  onReplay: () => void
  onLobby: () => void
}

const RESULT_STYLE = {
  win: { emoji: '🎉', title: '¡Ganaste la partida!', accent: 'text-emerald-400' },
  'blocked-win': { emoji: '🤝', title: 'Mesa bloqueada · Mano más ligera', accent: 'text-emerald-400' },
  loss: { emoji: '😢', title: 'Partida perdida', accent: 'text-red-400' },
  'blocked-loss': { emoji: '🤝', title: 'Mesa bloqueada', accent: 'text-red-400' },
  forfeit: { emoji: '🚪', title: 'Abandonaste la mesa', accent: 'text-amber-400' },
} as const

export function ResultDialog({
  open,
  outcome,
  stake,
  canReplay,
  replaying,
  onReplay,
  onLobby,
}: ResultDialogProps) {
  if (!outcome) return null

  const style = RESULT_STYLE[outcome.type]
  const positive = outcome.payout > 0

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="border-slate-700 bg-slate-900 sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <span className="text-6xl" aria-hidden>
            {style.emoji}
          </span>
          <DialogTitle className={`text-2xl ${style.accent}`}>{style.title}</DialogTitle>
          <DialogDescription className="text-center text-slate-400">{outcome.message}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-6 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="text-center">
            <p className="text-xs uppercase tracking-wide text-slate-500">Resultado</p>
            <p className={`text-2xl font-black ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
              {positive ? `+${outcome.payout}` : `-${stake}`} 🪙
            </p>
          </div>
          <div className="h-10 w-px bg-slate-800" aria-hidden />
          <div className="text-center">
            <p className="text-xs uppercase tracking-wide text-slate-500">Pozo de la mesa</p>
            <p className="text-2xl font-black text-amber-400">{potFor(stake)} 🪙</p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={onReplay}
            disabled={!canReplay || replaying}
            className="min-h-11 w-full bg-emerald-600 font-bold hover:bg-emerald-500"
          >
            {replaying ? 'Entrando…' : '🔁 Jugar otra vez'}
          </Button>
          {!canReplay && (
            <p className="text-center text-xs text-amber-400">
              No tienes tokens suficientes para repetir en esta mesa.
            </p>
          )}
          <Button
            onClick={onLobby}
            variant="outline"
            className="min-h-11 w-full border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-slate-100"
          >
            Volver al lobby
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
