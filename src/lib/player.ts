import { db } from '@/lib/db'
import type { Player } from '@prisma/client'

/**
 * Returns the single default player row, creating it (1000 starting tokens)
 * on first access. All game/profile endpoints operate on this row.
 */
export async function getOrCreatePlayer(): Promise<Player> {
  return db.player.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  })
}

/** The single player id used across the whole game. */
export const DEFAULT_PLAYER_ID = 'default' as const
