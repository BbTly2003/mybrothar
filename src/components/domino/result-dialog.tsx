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
import { SEAT_NAMES } from '@/lib/game/types'
import { cn } from '@/lib/utils'

interface ResultDialogProps {
  open: boolean
  outcome: GameOutcome | null
  onReplay: () => void
  onClose: () => void
  /** nombres reales por asiento rotados (multijugador); si falta, usa los de la mesa */
  seatNames?: string[]
  /** etiqueta del botón de revancha y si está habilitada (multijugador: solo el anfitrión) */
  replayLabel?: string
  replayDisabled?: boolean
}

const RESULT_STYLE = {
  win: { emoji: '🎉', title: '¡Ganaste la partida!', accent: 'text-emerald-400' },
  'blocked-win': { emoji: '🤝', title: 'Mesa bloqueada · ganaste', accent: 'text-emerald-400' },
  loss: { emoji: '😢', title: 'Partida perdida', accent: 'text-red-400' },
  'blocked-loss': { emoji: '🤝', title: 'Mesa bloqueada', accent: 'text-red-400' },
} as const

/** Diálogo de fin de partida (sin apuestas ni pozos: solo el resultado) */
export function ResultDialog({
  open,
  outcome,
  onReplay,
  onClose,
  seatNames,
  replayLabel = '🔁 Jugar otra vez',
  replayDisabled = false,
}: ResultDialogProps) {
  if (!outcome) return null

  const style = RESULT_STYLE[outcome.type]
  const sums = outcome.pipSums
  const minSum = sums ? Math.min(...sums) : 0

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent showCloseButton={false} className="border-slate-700 bg-slate-900 sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <span className="text-6xl" aria-hidden>
            {style.emoji}
          </span>
          <DialogTitle className={`text-2xl ${style.accent}`}>{style.title}</DialogTitle>
          <DialogDescription className="text-center text-slate-400">
            {outcome.message}
          </DialogDescription>
        </DialogHeader>

        {sums && (
          <div
            className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
            aria-label="Puntos en la mano al bloquearse la mesa"
          >
            <p className="mb-2 text-center text-xs uppercase tracking-wide text-slate-500">
              Puntos en la mano
            </p>
            <div className="flex items-center justify-center gap-4">
              {sums.map((s, seat) => (
                <div key={seat} className="text-center">
                  <p className="text-[10px] font-semibold text-slate-500">{seatNames?.[seat] ?? SEAT_NAMES[seat]}</p>
                  <p
                    className={cn(
                      'text-lg font-black',
                      s === minSum ? 'text-emerald-400' : 'text-slate-300',
                    )}
                  >
                    {s}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={onReplay}
            disabled={replayDisabled}
            className="min-h-11 w-full bg-emerald-600 font-bold hover:bg-emerald-500 disabled:opacity-60"
          >
            {replayLabel}
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            className="min-h-11 w-full border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-slate-100"
          >
            Volver a la mesa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
