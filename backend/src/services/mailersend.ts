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
  subject,
  html,
  variables,
}: {
  to: string;
  subject?: string;
  html?: string;
  variables: Record<string, string>;
}) {
  if (!MAILERSEND_API_TOKEN || !MAILERSEND_SENDER_EMAIL) {
    throw new Error('MailerSend API token or sender email not configured');
  }

  // Usar modo directo con HTML
  const finalHtml = html || buildActionEmailHtml(variables);
  const finalSubject = subject || 'Notification';
  
  const payload = {
    from: { email: MAILERSEND_SENDER_EMAIL },
    to: [{ email: to }],
    subject: finalSubject,
    html: finalHtml,
  };
  
  console.log('📧 MailerSend: Sending email');
  console.log('   Subject:', finalSubject);
  console.log('   Recipient:', to);
  console.log('   HTML length:', finalHtml.length, 'chars');

  try {
    const response = await axios.post(MAILERSEND_API_URL, payload, {
      headers: {
        Authorization: `Bearer ${MAILERSEND_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    
    console.log('✅ MailerSend: Email sent successfully');
    console.log('   Response status:', response.status);
  } catch (error: any) {
    console.error('❌ MailerSend: Failed to send email');
    console.error('   Status:', error?.response?.status);
    console.error('   Error message:', error?.response?.data?.message);
    console.error('   Full error response:', JSON.stringify(error?.response?.data, null, 2));
    throw error;
  }
}