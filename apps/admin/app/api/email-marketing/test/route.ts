import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/ses-mailer'

export const dynamic = 'force-dynamic'

// POST /api/email-marketing/test — send a test email
export async function POST(req: NextRequest) {
  const { to, subject, html } = await req.json()
  if (!to) return NextResponse.json({ error: 'to é obrigatório' }, { status: 400 })

  const result = await sendEmail({
    to,
    subject: subject ?? '[TESTE] Email Marketing — Plano da Ju',
    html: html ?? '<p>Este é um email de teste do módulo de Email Marketing do Plano da Ju. 🌿</p>',
  })

  return NextResponse.json(result)
}
