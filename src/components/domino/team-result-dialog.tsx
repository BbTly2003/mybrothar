'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { MatchInfo } from '@/lib/game/types'
import { cn } from '@/lib/utils'

interface TeamsResultDialogProps {
  open: boolean
  /** estado del partido ya rotado: teams[0]/scores[0] = equipo del receptor */
  match: MatchInfo | null
  /** nombre del compañero (asiento rotado de teams[0] ≠ 0) */
  partnerName: string
  rivalNames: string[]
  isHost: boolean
  onNewMatch: () => void
  onLeave: () => void
}

/** Diálogo del modo parejas: resumen de la mano terminada + marcador hacia
 *  los puntos objetivo, y cierre del partido cuando alguien llega a la meta. */
export function TeamsResultDialog({
  open,
  match,
  partnerName,
  rivalNames,
  isHost,
  onNewMatch,
  onLeave,
}: TeamsResultDialogProps) {
  const [left, setLeft] = useState<number | null>(null)

  const handOver = !!match && !match.matchOver
  const nextHandIn = match?.nextHandIn ?? 0

  // cuenta atrás local para la siguiente mano (tick dentro del intervalo)
  useEffect(() => {
    if (!open || !handOver || nextHandIn <= 0) return
    let remaining = Math.ceil(nextHandIn / 1000)
    const iv = window.setInterval(() => {
      remaining -= 1
      setLeft(Math.max(0, remaining))
      if (remaining <= 0) window.clearInterval(iv)
    }, 1000)
    return () => window.clearInterval(iv)
  }, [open, handOver, nextHandIn, match])

  const countdown = left ?? (nextHandIn > 0 ? Math.ceil(nextHandIn / 1000) : 0)

  if (!match) return null

  const { scores, targetPoints, teams, handPoints, matchOver } = match
  const iWonHand = handPoints?.winnerTeam === 0
  const iWonMatch = scores[0] >= targetPoints

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handOver && onLeave()}>
      <DialogContent showCloseButton={false} className="border-slate-700 bg-slate-900 sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <span className="text-6xl" aria-hidden>
            {matchOver ? (iWonMatch ? '🏆' : '💀') : iWonHand ? '🎉' : '😩'}
          </span>
          <DialogTitle className={cn('text-2xl', matchOver || iWonHand ? 'text-emerald-400' : 'text-red-400')}>
            {matchOver
              ? iWonMatch
                ? '¡Ganasteis el partido!'
                : 'Ganó la pareja rival'
              : iWonHand
                ? 'Tu pareja ganó la mano'
                : 'La pareja rival ganó la mano'}
          </DialogTitle>
          <DialogDescription className="text-center text-slate-400">
            {handPoints
              ? handPoints.reason === 'domino'
                ? `${handPoints.winnerTeam === 0 ? 'Se quedaron sin fichas' : 'Se quedaron sin fichas los rivales'}: +${handPoints.points} puntos de las fichas que quedaron en las manos.`
                : `Tranca: menos puntos en la mano. +${handPoints.points} puntos para ${handPoints.winnerTeam === 0 ? 'tu pareja' : 'la pareja rival'}.`
              : 'Esperando el resultado de la mano…'}
          </DialogDescription>
        </DialogHeader>

        {/* marcador del partido */}
        <div
          className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
          aria-label="Marcador del partido por parejas"
        >
          <div className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wide">
            <span className="flex-1 truncate text-emerald-300">
              🤝 Tú & {partnerName}
            </span>
            <span className="text-slate-500">Meta {targetPoints}</span>
            <span className="flex-1 truncate text-right text-rose-300">
              {rivalNames.join(' & ')}
            </span>
          </div>
          <div className="mt-1.5 flex items-end justify-center gap-4">
            <span className="text-3xl font-black text-emerald-400">{scores[0]}</span>
            <span className="pb-1 text-sm font-bold text-slate-600">—</span>
            <span className="text-3xl font-black text-rose-400">{scores[1]}</span>
          </div>
          {/* progreso hacia la meta */}
          <div className="mt-2 grid grid-cols-2 gap-2" aria-hidden>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width] duration-700"
                style={{ width: `${Math.min(100, (scores[0] / targetPoints) * 100)}%` }}
              />
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="ml-auto h-full rounded-full bg-rose-500 transition-[width] duration-700"
                style={{ width: `${Math.min(100, (scores[1] / targetPoints) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {matchOver ? (
            <Button
              onClick={onNewMatch}
              disabled={!isHost}
              className="min-h-11 w-full bg-emerald-600 font-bold hover:bg-emerald-500 disabled:opacity-60"
            >
              {isHost ? '🔄 Nuevo partido' : '⏳ Esperando al anfitrión…'}
            </Button>
          ) : (
            <p
              className="animate-pulse rounded-lg bg-slate-950/60 px-3 py-2.5 text-center text-xs font-bold text-slate-400"
              role="status"
            >
              Repartiendo la siguiente mano en {nextHandIn > 0 || left !== null ? `${countdown}s` : 'unos segundos'}…
            </p>
          )}
          <Button
            onClick={onLeave}
            variant="outline"
            className="min-h-11 w-full border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-slate-100"
          >
            🚪 Salir de la sala
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
