import { NextRequest, NextResponse } from 'next/server'
import sgMail from '@sendgrid/mail'

export async function POST(req: NextRequest) {
  const { to } = await req.json().catch(() => ({ to: '' }))

  const apiKey = process.env.SENDGRID_API_KEY
  const fromEmail = process.env.SENDGRID_FROM_EMAIL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  // Report env state (mask key)
  const envReport = {
    hasApiKey: !!apiKey,
    apiKeyPrefix: apiKey ? apiKey.slice(0, 10) + '...' : 'MISSING',
    apiKeyLength: apiKey?.length ?? 0,
    fromEmail: fromEmail ?? 'MISSING',
    appUrl: appUrl ?? 'MISSING',
    toEmail: to || 'MISSING',
  }

  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'SENDGRID_API_KEY not set', env: envReport })
  }
  if (!fromEmail) {
    return NextResponse.json({ ok: false, error: 'SENDGRID_FROM_EMAIL not set', env: envReport })
  }
  if (!to) {
    return NextResponse.json({ ok: false, error: 'POST body must include { "to": "your@email.com" }', env: envReport })
  }

  try {
    sgMail.setApiKey(apiKey)
    await sgMail.send({
      to,
      from: { email: fromEmail, name: process.env.SENDGRID_FROM_NAME ?? 'USPS SIMS' },
      subject: 'SIMS Email Test',
      text: 'If you see this, SendGrid is working correctly.',
      html: '<p>If you see this, <strong>SendGrid is working correctly</strong>.</p>',
    })
    return NextResponse.json({ ok: true, message: `Test email sent to ${to}`, env: envReport })
  } catch (err: any) {
    const sgError = err?.response?.body ?? err?.message ?? String(err)
    return NextResponse.json({ ok: false, error: sgError, env: envReport }, { status: 500 })
  }
}
