import { NextRequest, NextResponse } from 'next/server'
import sgMail from '@sendgrid/mail'
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length))
  return `SIMS@${result}`
}

function brandedHtml(userName: string, email: string, tempPassword: string, loginUrl: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#004B87;padding:24px 32px;">
          <span style="color:white;font-size:18px;font-weight:800;letter-spacing:0.05em;">SIMS</span>
          <span style="color:#c8d9ec;font-size:12px;margin-left:12px;">Supplier Information Management System</span>
        </td></tr>
        <tr><td style="background:#DA291C;padding:10px 32px;">
          <span style="color:white;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Password Reset</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;font-size:15px;color:#1a2332;font-weight:600;">Dear ${userName},</p>
          <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
            A password reset was requested for your USPS SIMS account. Your new temporary password is below.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin:20px 0;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 12px;font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase;">Your New Credentials</p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:13px;color:#6b7280;font-weight:600;padding:4px 0;width:130px;">Login Page:</td>
                  <td><a href="${loginUrl}" style="color:#004B87;font-size:13px;font-weight:600;">${loginUrl}</a></td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#6b7280;font-weight:600;padding:4px 0;">Email:</td>
                  <td style="font-size:13px;color:#1a2332;font-weight:600;padding:4px 0;">${email}</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#6b7280;font-weight:600;padding:4px 0;">Temp Password:</td>
                  <td style="font-size:16px;color:#DA291C;font-weight:800;padding:4px 0;letter-spacing:0.08em;">${tempPassword}</td>
                </tr>
              </table>
            </td></tr>
          </table>
          <p style="font-size:13px;color:#6b7280;line-height:1.6;">
            Please change your password immediately after logging in. If you did not request a reset, contact your system administrator.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
            <tr><td style="background:#004B87;border-radius:6px;">
              <a href="${loginUrl}" style="display:inline-block;padding:12px 28px;color:white;font-size:14px;font-weight:700;text-decoration:none;">Login Now →</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 32px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#9ca3af;">United States Postal Service · SIMS — Supplier Information Management System</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

    const apiKey = process.env.SENDGRID_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'SENDGRID_API_KEY not configured' }, { status: 500 })

    // Always return success — don't leak whether the email exists
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, name, email, user_type')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()

    if (!user) return NextResponse.json({ success: true })

    const tempPassword = generateTempPassword()
    const passwordHash = await bcrypt.hash(tempPassword, 10)
    await supabaseAdmin.from('users').update({ password_hash: passwordHash }).eq('id', user.id)

    const portalUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sims.usps.gov'
    const loginUrl = user.user_type === 'supplier'
      ? `${portalUrl}/supplier/login`
      : `${portalUrl}/login`

    sgMail.setApiKey(apiKey)
    await sgMail.send({
      to: user.email,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL ?? 'noreply@usps.gov',
        name: process.env.SENDGRID_FROM_NAME ?? 'USPS SIMS',
      },
      subject: 'USPS SIMS — Password Reset',
      html: brandedHtml(user.name ?? user.email, user.email, tempPassword, loginUrl),
      text: `Dear ${user.name ?? user.email},\n\nYour SIMS password has been reset.\n\nLogin: ${loginUrl}\nEmail: ${user.email}\nTemp Password: ${tempPassword}\n\nPlease change your password after logging in.\n\nUSPS SIMS`,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Password reset email error:', err?.response?.body ?? err)
    return NextResponse.json({ error: err?.message ?? 'Failed to send email' }, { status: 500 })
  }
}
