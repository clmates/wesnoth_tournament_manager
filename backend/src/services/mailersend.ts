import axios from 'axios';

const MAILERSEND_API_URL = process.env.MAILERSEND_API_URL || 'https://api.mailersend.com/v1/email';
const MAILERSEND_API_TOKEN = process.env.MAILERSEND_API_TOKEN;
const MAILERSEND_SENDER_EMAIL = process.env.MAILERSEND_SENDER_EMAIL;

export async function sendMailerSendEmail({
  to,
  templateId,
  variables,
}: {
  to: string;
  templateId: string;
  variables: Record<string, string>;
}) {
  if (!MAILERSEND_API_TOKEN || !MAILERSEND_SENDER_EMAIL) {
    throw new Error('MailerSend API token or sender email not configured');
  }

  const payload = {
    from: { email: MAILERSEND_SENDER_EMAIL },
    to: [{ email: to }],
    template_id: templateId,
    personalization: [
      {
        email: to,
        data: variables,
      },
    ],
  };

  await axios.post(MAILERSEND_API_URL, payload, {
    headers: {
      Authorization: `Bearer ${MAILERSEND_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
}