'use client'

import { DominoTile } from './domino-tile'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Side, Tile } from '@/lib/game/types'
import { getEnds } from '@/lib/game/engine'

interface SidePickerDialogProps {
  open: boolean
  tile: Tile | null
  sides: Side[]
  chainEnds: { left: number; right: number } | null
  onChoose: (side: Side) => void
  onCancel: () => void
}

/** Diálogo para elegir el extremo (izquierda/derecha) cuando la ficha encaja en ambos */
export function SidePickerDialog({ open, tile, sides, chainEnds, onChoose, onCancel }: SidePickerDialogProps) {
  if (!tile) return null
  const ends = chainEnds ?? getEnds([])

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="border-slate-700 bg-slate-900 sm:max-w-sm">
        <DialogHeader className="items-center">
          <DialogTitle className="text-slate-100">¿Dónde colocas la ficha?</DialogTitle>
          <DialogDescription className="text-center">
            La ficha encaja en ambos extremos de la cadena.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center py-1">
          <DominoTile size="lg" top={tile.a} bottom={tile.b} ariaLabel={`Ficha seleccionada ${tile.a} y ${tile.b}`} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => onChoose('left')}
            disabled={!sides.includes('left')}
            variant="outline"
            className="min-h-16 flex-col gap-0.5 border-emerald-600/50 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 hover:text-emerald-200"
          >
            <span className="text-lg font-bold">⬅ Izquierda</span>
            <span className="text-xs opacity-80">extremo: {ends?.left ?? '—'}</span>
          </Button>
          <Button
            onClick={() => onChoose('right')}
            disabled={!sides.includes('right')}
            variant="outline"
            className="min-h-16 flex-col gap-0.5 border-emerald-600/50 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 hover:text-emerald-200"
          >
            <span className="text-lg font-bold">Derecha ➡</span>
            <span className="text-xs opacity-80">extremo: {ends?.right ?? '—'}</span>
          </Button>
        </div>

        <Button
          onClick={onCancel}
          variant="ghost"
          className="min-h-9 text-slate-400 hover:text-slate-200"
        >
          Cancelar
        </Button>
      </DialogContent>
    </Dialog>
  )
}
