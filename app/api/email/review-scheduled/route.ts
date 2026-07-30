import { NextRequest, NextResponse } from 'next/server'
import sgMail from '@sendgrid/mail'

export async function POST(req: NextRequest) {
  try {
    const {
      supplierName,
      reviewTitle,
      reviewDate,
      meetingLink,
      attendees,
      planId,
      supplierId,
    }: {
      supplierName: string
      reviewTitle: string
      reviewDate: string
      meetingLink?: string
      attendees: Array<{ name: string; email: string }>
      planId: string
      supplierId: string
    } = await req.json()

    const apiKey = process.env.SENDGRID_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'SENDGRID_API_KEY not configured' }, { status: 500 })

    if (!attendees?.length) return NextResponse.json({ success: true })

    const portalUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sims.usps.gov'
    const planLink = `${portalUrl}/supplier-performance/suppliers/${supplierId}/development-plans/${planId}`

    sgMail.setApiKey(apiKey)
    const from = {
      email: process.env.SENDGRID_FROM_EMAIL ?? 'noreply@usps.gov',
      name: process.env.SENDGRID_FROM_NAME ?? 'USPS SIMS',
    }

    const htmlBody = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#004B87;padding:24px 32px;">
          <span style="color:white;font-size:18px;font-weight:800;letter-spacing:0.05em;">SIMS</span>
          <span style="color:#c8d9ec;font-size:12px;margin-left:12px;">Supplier Information Management System</span>
        </td></tr>
        <tr><td style="background:#1d4ed8;padding:10px 32px;">
          <span style="color:white;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Performance Review Scheduled</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
            A performance review has been scheduled for <strong>${supplierName}</strong>. Details are below.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin:16px 0;">
            <tr><td style="padding:20px 24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:13px;color:#6b7280;font-weight:600;padding:4px 0;width:140px;">Supplier:</td>
                  <td style="font-size:13px;color:#1a2332;font-weight:700;padding:4px 0;">${supplierName}</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#6b7280;font-weight:600;padding:4px 0;">Review:</td>
                  <td style="font-size:13px;color:#1a2332;font-weight:600;padding:4px 0;">${reviewTitle}</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#6b7280;font-weight:600;padding:4px 0;">Date / Time:</td>
                  <td style="font-size:13px;color:#1a2332;font-weight:600;padding:4px 0;">${reviewDate}</td>
                </tr>
                ${meetingLink ? `<tr>
                  <td style="font-size:13px;color:#6b7280;font-weight:600;padding:4px 0;">Meeting Link:</td>
                  <td style="font-size:13px;padding:4px 0;"><a href="${meetingLink}" style="color:#004B87;">${meetingLink}</a></td>
                </tr>` : ''}
              </table>
            </td></tr>
          </table>
          <table cellpadding="0" cellspacing="0" style="margin:20px 0;">
            <tr><td style="background:#004B87;border-radius:6px;">
              <a href="${planLink}" style="display:inline-block;padding:12px 28px;color:white;font-size:14px;font-weight:700;text-decoration:none;">View Development Plan →</a>
            </td></tr>
          </table>
          <p style="margin:0;font-size:12px;color:#9ca3af;">This is an automated message from USPS SIMS.</p>
        </td></tr>
        <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 32px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#9ca3af;">United States Postal Service · SIMS — Supplier Information Management System</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

    const sends = attendees
      .filter(a => a.email)
      .map(a =>
        sgMail.send({
          to: a.email,
          from,
          subject: `Performance Review Scheduled — ${supplierName}`,
          html: htmlBody,
          text: `Performance review scheduled for ${supplierName}.\n\nReview: ${reviewTitle}\nDate: ${reviewDate}${meetingLink ? `\nMeeting: ${meetingLink}` : ''}\n\nView in SIMS: ${planLink}`,
        })
      )

    await Promise.allSettled(sends)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Review scheduled email error:', err?.response?.body ?? err)
    return NextResponse.json({ error: err?.message ?? 'Failed to send email' }, { status: 500 })
  }
}
