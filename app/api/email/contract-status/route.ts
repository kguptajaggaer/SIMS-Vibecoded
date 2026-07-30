import { NextRequest, NextResponse } from 'next/server'
import sgMail from '@sendgrid/mail'

const STATUS_LABELS: Record<string, string> = {
  new_contract: 'New Contract',
  open_for_reporting: 'Open for Reporting',
  ready_for_co_review: 'Ready for CO Review',
  ready_for_portfolio_review: 'Ready for Portfolio Review',
  ready_for_diversity_review: 'Ready for Diversity Review',
  close_for_report: 'Closed for Report',
  closed: 'Closed',
  enter_epp_data: 'Enter EPP Data',
  ready_for_epp_admin_review: 'Ready for EPP Admin Review',
  finalized: 'Finalized',
}

function buildHtml(opts: {
  heading: string
  contractNumber: string
  supplierName: string
  newStatus: string
  portalUrl: string
  contractLink: string
  rejectionReason?: string
  bodyText: string
}): string {
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
          <span style="color:white;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">${opts.heading}</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">${opts.bodyText}</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin:16px 0;">
            <tr><td style="padding:16px 24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:13px;color:#6b7280;font-weight:600;padding:4px 0;width:150px;">Contract No:</td>
                  <td style="font-size:13px;color:#1a2332;font-weight:700;padding:4px 0;">${opts.contractNumber}</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#6b7280;font-weight:600;padding:4px 0;">Supplier:</td>
                  <td style="font-size:13px;color:#1a2332;font-weight:600;padding:4px 0;">${opts.supplierName}</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#6b7280;font-weight:600;padding:4px 0;">New Status:</td>
                  <td style="font-size:13px;font-weight:700;padding:4px 0;color:#004B87;">${STATUS_LABELS[opts.newStatus] ?? opts.newStatus}</td>
                </tr>
                ${opts.rejectionReason ? `<tr>
                  <td style="font-size:13px;color:#6b7280;font-weight:600;padding:4px 0;vertical-align:top;">Reason:</td>
                  <td style="font-size:13px;color:#DC2626;padding:4px 0;">${opts.rejectionReason}</td>
                </tr>` : ''}
              </table>
            </td></tr>
          </table>
          <table cellpadding="0" cellspacing="0" style="margin:20px 0;">
            <tr><td style="background:#004B87;border-radius:6px;">
              <a href="${opts.contractLink}" style="display:inline-block;padding:12px 28px;color:white;font-size:14px;font-weight:700;text-decoration:none;">View Contract →</a>
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
}

export async function POST(req: NextRequest) {
  try {
    const {
      contractId,
      contractNumber,
      supplierName,
      supplierEmail,
      contractOfficer,
      contractOfficerEmail,
      newStatus,
      oldStatus,
      rejectionReason,
      contractModule = 'subk',
    } = await req.json()

    const apiKey = process.env.SENDGRID_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'SENDGRID_API_KEY not configured' }, { status: 500 })

    const portalUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sims.usps.gov'
    const internalLink = `${portalUrl}/compliance/${contractModule}/contracts/${contractId}`
    const supplierLink = `${portalUrl}/supplier/compliance/${contractModule}/${contractId}`

    sgMail.setApiKey(apiKey)
    const from = {
      email: process.env.SENDGRID_FROM_EMAIL ?? 'noreply@usps.gov',
      name: process.env.SENDGRID_FROM_NAME ?? 'USPS SIMS',
    }

    const sends: Promise<any>[] = []

    if (newStatus === 'ready_for_co_review' && contractOfficerEmail) {
      sends.push(sgMail.send({
        to: contractOfficerEmail,
        from,
        subject: `Action Required: Contract ${contractNumber} Ready for CO Review`,
        html: buildHtml({
          heading: 'Action Required — CO Review',
          contractNumber,
          supplierName,
          newStatus,
          portalUrl,
          contractLink: internalLink,
          bodyText: `Contract <strong>${contractNumber}</strong> for <strong>${supplierName}</strong> has been submitted and is ready for your review as the Contract Officer.`,
        }),
        text: `Contract ${contractNumber} for ${supplierName} is ready for CO review.\n\nLogin to SIMS to review: ${internalLink}`,
      }))
    }

    if (newStatus === 'ready_for_portfolio_review' && contractOfficerEmail) {
      sends.push(sgMail.send({
        to: contractOfficerEmail,
        from,
        subject: `Contract ${contractNumber} Approved — Pending Portfolio Review`,
        html: buildHtml({
          heading: 'Contract Approved — Portfolio Review Pending',
          contractNumber,
          supplierName,
          newStatus,
          portalUrl,
          contractLink: internalLink,
          bodyText: `Contract <strong>${contractNumber}</strong> has passed CO review and is now pending Portfolio Review.`,
        }),
        text: `Contract ${contractNumber} approved at CO level. Awaiting portfolio review.\n\n${internalLink}`,
      }))
    }

    if (newStatus === 'open_for_reporting' && oldStatus !== 'new_contract' && supplierEmail) {
      // Returned after rejection
      sends.push(sgMail.send({
        to: supplierEmail,
        from,
        subject: `Action Required: Contract ${contractNumber} Returned for Revision`,
        html: buildHtml({
          heading: 'Contract Returned — Action Required',
          contractNumber,
          supplierName,
          newStatus,
          portalUrl,
          contractLink: supplierLink,
          rejectionReason,
          bodyText: `Your submission for contract <strong>${contractNumber}</strong> has been returned and requires revision. Please review the feedback and resubmit.`,
        }),
        text: `Contract ${contractNumber} has been returned.\nReason: ${rejectionReason ?? 'See SIMS for details'}\n\n${supplierLink}`,
      }))
    }

    if (newStatus === 'close_for_report') {
      const targets = [
        supplierEmail && { to: supplierEmail, link: supplierLink },
        contractOfficerEmail && { to: contractOfficerEmail, link: internalLink },
      ].filter(Boolean) as { to: string; link: string }[]
      for (const t of targets) {
        sends.push(sgMail.send({
          to: t.to,
          from,
          subject: `Contract ${contractNumber} — Reporting Period Closed`,
          html: buildHtml({
            heading: 'Reporting Period Closed',
            contractNumber,
            supplierName,
            newStatus,
            portalUrl,
            contractLink: t.link,
            bodyText: `The reporting period for contract <strong>${contractNumber}</strong> has been closed.`,
          }),
          text: `Contract ${contractNumber} reporting period closed.\n\n${t.link}`,
        }))
      }
    }

    if (newStatus === 'closed') {
      const targets = [
        supplierEmail && { to: supplierEmail, link: supplierLink },
        contractOfficerEmail && { to: contractOfficerEmail, link: internalLink },
      ].filter(Boolean) as { to: string; link: string }[]
      for (const t of targets) {
        sends.push(sgMail.send({
          to: t.to,
          from,
          subject: `Contract ${contractNumber} Successfully Closed`,
          html: buildHtml({
            heading: 'Contract Closed',
            contractNumber,
            supplierName,
            newStatus,
            portalUrl,
            contractLink: t.link,
            bodyText: `Contract <strong>${contractNumber}</strong> for <strong>${supplierName}</strong> has been successfully closed.`,
          }),
          text: `Contract ${contractNumber} has been closed.\n\n${t.link}`,
        }))
      }
    }

    await Promise.allSettled(sends)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Contract status email error:', err?.response?.body ?? err)
    return NextResponse.json({ error: err?.message ?? 'Failed to send email' }, { status: 500 })
  }
}
