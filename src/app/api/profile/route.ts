import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreatePlayer } from '@/lib/player'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const player = await getOrCreatePlayer()

    const recentGames = await db.gameRecord.findMany({
      where: { playerId: player.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        stake: true,
        pot: true,
        outcome: true,
        payout: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      tokens: player.tokens,
      stats: {
        gamesPlayed: player.gamesPlayed,
        gamesWon: player.gamesWon,
        tokensWon: player.tokensWon,
      },
      recentGames,
    })
  } catch (error) {
    console.error('[GET /api/profile]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
