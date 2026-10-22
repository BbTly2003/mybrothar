import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getOrCreatePlayer } from '@/lib/player'

export const dynamic = 'force-dynamic'

const VALID_STAKES = [100, 200, 300, 500] as const

const joinSchema = z.object({
  stake: z
    .number()
    .int()
    .refine(
      (value): value is (typeof VALID_STAKES)[number] =>
        (VALID_STAKES as readonly number[]).includes(value),
      { message: 'La apuesta debe ser 100, 200, 300 o 500.' }
    ),
})

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json().catch(() => null)
    const parsed = joinSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Apuesta inválida. Debe ser 100, 200, 300 o 500.' },
        { status: 400 }
      )
    }

    const { stake } = parsed.data
    const player = await getOrCreatePlayer()

    if (player.tokens < stake) {
      return NextResponse.json(
        { error: 'No tienes suficientes tokens para entrar a esta mesa.' },
        { status: 400 }
      )
    }

    const updated = await db.player.update({
      where: { id: player.id },
      data: { tokens: { decrement: stake } },
    })

    return NextResponse.json({ tokens: updated.tokens })
  } catch (error) {
    console.error('[POST /api/game/join]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
