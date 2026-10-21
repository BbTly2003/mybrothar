import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getOrCreatePlayer } from '@/lib/player'

export const dynamic = 'force-dynamic'

const VALID_STAKES = [100, 200, 300, 500] as const
const OUTCOMES = ['win', 'loss', 'draw', 'forfeit'] as const

const resultSchema = z
  .object({
    stake: z
      .number()
      .int()
      .refine(
        (value): value is (typeof VALID_STAKES)[number] =>
          (VALID_STAKES as readonly number[]).includes(value),
        { message: 'La apuesta debe ser 100, 200, 300 o 500.' }
      ),
    outcome: z.enum(OUTCOMES),
    payout: z.number().int().min(0),
  })
  .refine((data) => data.payout <= data.stake * 4, {
    message: 'El pago no puede superar el bote máximo.',
    path: ['payout'],
  })

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json().catch(() => null)
    const parsed = resultSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos de partida inválidos.' },
        { status: 400 }
      )
    }

    const { stake, outcome, payout } = parsed.data
    const player = await getOrCreatePlayer()

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.player.update({
        where: { id: player.id },
        data: {
          tokens: Math.max(0, player.tokens + payout),
          gamesPlayed: { increment: 1 },
          gamesWon: outcome === 'win' ? { increment: 1 } : undefined,
          tokensWon: { increment: payout },
        },
      })

      await tx.gameRecord.create({
        data: {
          playerId: player.id,
          stake,
          pot: stake * 4,
          outcome,
          payout,
        },
      })

      return result
    })

    return NextResponse.json({
      tokens: updated.tokens,
      stats: {
        gamesPlayed: updated.gamesPlayed,
        gamesWon: updated.gamesWon,
        tokensWon: updated.tokensWon,
      },
    })
  } catch (error) {
    console.error('[POST /api/game/result]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
