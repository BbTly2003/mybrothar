'use client'

import { cn } from '@/lib/utils'
import type { LogEntry } from '@/lib/game/types'

const KIND_STYLES: Record<LogEntry['kind'], string> = {
  info: 'text-zinc-400',
  play: 'text-emerald-300',
  pass: 'text-amber-400',
  win: 'text-emerald-400 font-bold',
  lose: 'text-red-400',
  system: 'text-teal-300',
}

const KIND_PREFIX: Record<LogEntry['kind'], string> = {
  info: '›',
  play: '▶',
  pass: '⏸',
  win: '★',
  lose: '✖',
  system: '◈',
}

/** Bitácora de la partida (la entrada más reciente arriba) */
export function GameLog({ entries }: { entries: LogEntry[] }) {
  return (
    <div
      className="scrollbar-thin max-h-32 overflow-y-auto rounded-2xl border border-white/10 bg-black/35 p-3 text-left backdrop-blur-sm"
      role="log"
      aria-live="polite"
      aria-label="Bitácora de la partida"
    >
      {entries.length === 0 ? (
        <p className="text-xs text-slate-500">La partida acaba de comenzar…</p>
      ) : (
        <ul className="space-y-1">
          {entries.map((entry) => (
            <li key={entry.id} className={cn('flex gap-2 text-xs leading-relaxed', KIND_STYLES[entry.kind])}>
              <span aria-hidden className="shrink-0 opacity-70">
                {KIND_PREFIX[entry.kind]}
              </span>
              <span>{entry.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
