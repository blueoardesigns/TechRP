import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'TechRP <noreply@blueoardesigns.com>';
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function sendCoachApprovalRequest({
  coachEmail,
  coachName,
  companyName,
  permissionLevel,
  approvalToken,
}: {
  coachEmail: string;
  coachName: string;
  companyName: string;
  permissionLevel: 'edit_playbooks' | 'readonly';
  approvalToken: string;
}) {
  const acceptUrl = `${BASE_URL}/api/coach/connections/${approvalToken}/respond?action=accept`;
  const declineUrl = `${BASE_URL}/api/coach/connections/${approvalToken}/respond?action=decline`;

  const permissionText =
    permissionLevel === 'edit_playbooks'
      ? 'view their users, training sessions, recordings, <strong>and edit their playbooks</strong>'
      : 'view their users, training sessions, and recordings (read-only)';

  await resend.emails.send({
    from: FROM,
    to: coachEmail,
    subject: `${companyName} wants to connect with you on TechRP`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
        <h2 style="margin-bottom:8px">Connection Request</h2>
        <p>Hi ${coachName},</p>
        <p><strong>${companyName}</strong> has requested to connect with you on TechRP.</p>
        <p>If you accept, you will be able to ${permissionText} for this company.</p>
        <div style="margin:32px 0">
          <a href="${acceptUrl}"
             style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-right:12px">
            Accept
          </a>
          <a href="${declineUrl}"
             style="background:#4b5563;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
            Decline
          </a>
        </div>
        <p style="color:#6b7280;font-size:13px">
          If you did not expect this request, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}

export async function sendConnectionAccepted({
  companyAdminEmail,
  companyName,
  coachName,
}: {
  companyAdminEmail: string;
  companyName: string;
  coachName: string;
}) {
  await resend.emails.send({
    from: FROM,
    to: companyAdminEmail,
    subject: `${coachName} has accepted your connection request`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
        <h2>Connection Accepted</h2>
        <p><strong>${coachName}</strong> has accepted your connection request for <strong>${companyName}</strong>.</p>
        <p>They now have access to your account. You can manage this connection from your dashboard.</p>
      </div>
    `,
  });
}

export async function sendConnectionDeclined({
  companyAdminEmail,
  companyName,
  coachName,
}: {
  companyAdminEmail: string;
  companyName: string;
  coachName: string;
}) {
  await resend.emails.send({
    from: FROM,
    to: companyAdminEmail,
    subject: `${coachName} declined your connection request`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
        <h2>Connection Declined</h2>
        <p><strong>${coachName}</strong> has declined the connection request for <strong>${companyName}</strong>.</p>
        <p>You can reach out to them directly to discuss access.</p>
      </div>
    `,
  });
}

export async function sendConnectionRemoved({
  recipientEmail,
  recipientName,
  removerName,
  companyName,
}: {
  recipientEmail: string;
  recipientName: string;
  removerName: string;
  companyName: string;
}) {
  await resend.emails.send({
    from: FROM,
    to: recipientEmail,
    subject: `Connection with ${companyName} has been removed`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
        <h2>Connection Removed</h2>
        <p>Hi ${recipientName},</p>
        <p><strong>${removerName}</strong> has removed the coaching connection for <strong>${companyName}</strong>.</p>
        <p>Access to this company's data has been revoked.</p>
      </div>
    `,
  });
}
