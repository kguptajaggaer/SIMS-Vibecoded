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
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `SIMS@${result}`
}

export async function POST(req: NextRequest) {
  try {
    const { supplierId, supplierName, email, isResend } = await req.json()

    if (!supplierId || !email) {
      return NextResponse.json({ error: 'supplierId and email are required' }, { status: 400 })
    }

    const apiKey = process.env.SENDGRID_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'SENDGRID_API_KEY not configured' }, { status: 500 })
    }

    const tempPassword = generateTempPassword()
    const passwordHash = await bcrypt.hash(tempPassword, 10)

    // Check if a supplier user account already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('supplier_id', supplierId)
      .eq('user_type', 'supplier')
      .maybeSingle()

    if (existingUser) {
      await supabaseAdmin
        .from('users')
        .update({ password_hash: passwordHash, is_active: true })
        .eq('id', existingUser.id)
    } else {
      const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_')
      await supabaseAdmin.from('users').insert({
        email: email.trim().toLowerCase(),
        name: supplierName,
        username,
        password_hash: passwordHash,
        user_type: 'supplier',
        supplier_id: supplierId,
        is_active: true,
      })
    }

    // Mark supplier as active / invited
    await supabaseAdmin
      .from('suppliers')
      .update({ status: 'active' })
      .eq('id', supplierId)

    // Send email
    sgMail.setApiKey(apiKey)

    const portalUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sims.usps.gov'
    const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? 'noreply@usps.gov'
    const fromName = process.env.SENDGRID_FROM_NAME ?? 'USPS SIMS'

    const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background-color:#004B87;padding:28px 32px;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="background:white;border-radius:6px;padding:6px 12px;">
                <span style="color:#004B87;font-size:18px;font-weight:800;letter-spacing:0.05em;">SIMS</span>
              </td>
              <td style="padding-left:14px;">
                <span style="color:#c8d9ec;font-size:12px;">Supplier Information Management System</span>
              </td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="background-color:#DA291C;padding:10px 32px;">
            <span style="color:white;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">
              ${isResend ? 'Your access has been updated' : 'Welcome to the USPS Supplier Portal'}
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 18px;font-size:15px;color:#1a2332;font-weight:600;">Dear ${supplierName},</p>
            <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
              ${isResend
                ? 'Your USPS SIMS supplier portal access has been reset. Use the credentials below to log in.'
                : 'You have been registered as a supplier in the USPS Supplier Information Management System (SIMS). Please use the credentials below to log in to the supplier portal.'}
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin:20px 0;">
              <tr><td style="padding:20px 24px;">
                <p style="margin:0 0 12px;font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Your Login Credentials</p>
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:13px;color:#6b7280;font-weight:600;padding:4px 0;width:130px;">Portal URL:</td>
                    <td style="font-size:13px;font-weight:600;padding:4px 0;">
                      <a href="${portalUrl}/supplier/login" style="color:#004B87;">${portalUrl}/supplier/login</a>
                    </td>
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
            <p style="margin:16px 0;font-size:13px;color:#6b7280;line-height:1.6;">
              For security, please change your password after your first login. If you have trouble accessing the portal, contact your USPS contract officer.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
              <tr>
                <td style="background-color:#004B87;border-radius:6px;">
                  <a href="${portalUrl}/supplier/login" style="display:inline-block;padding:12px 28px;color:white;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.02em;">
                    Access Supplier Portal →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
              This is an automated message from USPS SIMS. Please do not reply to this email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">United States Postal Service · SIMS — Supplier Information Management System</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    const textBody = `Dear ${supplierName},

${isResend ? 'Your USPS SIMS supplier portal access has been reset.' : 'You have been registered as a supplier in the USPS SIMS.'}

PORTAL URL: ${portalUrl}/supplier/login
EMAIL: ${email}
TEMPORARY PASSWORD: ${tempPassword}

Please change your password after your first login.

USPS SIMS — Supplier Information Management System`

    await sgMail.send({
      to: email,
      from: { email: fromEmail, name: fromName },
      subject: isResend
        ? 'USPS SIMS — Your Supplier Portal Access Has Been Reset'
        : 'USPS SIMS — Welcome to the Supplier Portal',
      html: htmlBody,
      text: textBody,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Supplier invite email error:', err?.response?.body ?? err)
    return NextResponse.json(
      { error: err?.message ?? 'Failed to send email' },
      { status: 500 }
    )
  }
}
