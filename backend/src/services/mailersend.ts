import axios from 'axios';

const MAILERSEND_API_URL = process.env.MAILERSEND_API_URL || 'https://api.mailersend.com/v1/email';
const MAILERSEND_API_TOKEN = process.env.MAILERSEND_API_TOKEN;
const MAILERSEND_SENDER_EMAIL = process.env.MAILERSEND_SENDER_EMAIL;

function buildActionEmailHtml(variables: Record<string, string>): string {
  const { message = '', action_url = '', action_label = 'Click here', greetings } = variables;
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .content { margin: 20px 0; }
          .button { 
            display: inline-block; 
            padding: 12px 30px; 
            background-color: #007bff; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0;
          }
          .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Wesnoth Tournament Manager</h1>
          </div>
          <div class="content">
            <p>${greetings || 'Greetings'},</p>
            <p>${message}</p>
            <center>
              <a href="${action_url}" class="button">${action_label}</a>
            </center>
          </div>
          <div class="footer">
            <p>© 2026 Wesnoth Tournament Manager. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function sendMailerSendEmail({
  to,
  templateId,
  subject,
  html,
  variables,
}: {
  to: string;
  templateId?: string;
  subject?: string;
  html?: string;
  variables: Record<string, string>;
}) {
  if (!MAILERSEND_API_TOKEN || !MAILERSEND_SENDER_EMAIL) {
    throw new Error('MailerSend API token or sender email not configured');
  }

  // Determinar si usar template o modo directo
  const useTemplate = templateId && templateId.trim();
  
  let payload: any;

  if (useTemplate) {
    // Modo template
    payload = {
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
  } else {
    // Modo directo - requiere subject y html
    const finalHtml = html || buildActionEmailHtml(variables);
    const finalSubject = subject || 'Notification';
    
    payload = {
      from: { email: MAILERSEND_SENDER_EMAIL },
      to: [{ email: to }],
      subject: finalSubject,
      html: finalHtml,
    };
  }

  try {
    await axios.post(MAILERSEND_API_URL, payload, {
      headers: {
        Authorization: `Bearer ${MAILERSEND_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    // Si falla el template, intentar con modo directo
    if (useTemplate && error?.response?.status === 422) {
      console.warn(`Template ${templateId} failed (422), falling back to direct email mode`);
      
      const finalHtml = html || buildActionEmailHtml(variables);
      const finalSubject = subject || 'Notification';
      
      const fallbackPayload = {
        from: { email: MAILERSEND_SENDER_EMAIL },
        to: [{ email: to }],
        subject: finalSubject,
        html: finalHtml,
      };
      
      await axios.post(MAILERSEND_API_URL, fallbackPayload, {
        headers: {
          Authorization: `Bearer ${MAILERSEND_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });
    } else {
      throw error;
    }
  }
}