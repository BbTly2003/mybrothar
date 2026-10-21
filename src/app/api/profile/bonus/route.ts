import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreatePlayer } from '@/lib/player'

export const dynamic = 'force-dynamic'

/**
 * Rescue bonus ("reclamar 500 tokens gratis").
 * Grants 500 tokens only when the player has fewer than 100 tokens.
 */
export async function POST() {
  try {
    const player = await getOrCreatePlayer()

    if (player.tokens >= 100) {
      return NextResponse.json({ granted: false, tokens: player.tokens })
    }

    const updated = await db.player.update({
      where: { id: player.id },
      data: { tokens: { increment: 500 } },
    })

    return NextResponse.json({ granted: true, tokens: updated.tokens })
  } catch (error) {
    console.error('[POST /api/profile/bonus]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
