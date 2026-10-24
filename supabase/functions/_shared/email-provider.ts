// Provider adapter: Gmail API for domain-free sending, or Resend for verified domains.
// Secrets are read only inside Supabase Edge Functions and never sent to clients.
export type MailRequest = { to: string; subject: string; text: string; html?: string; idempotencyKey?: string };
export type EnvReader = (name: string) => string | undefined;
type Fetcher = typeof fetch;
const currentEnv: EnvReader = (name) => Deno.env.get(name);

function required(read: EnvReader, name: string): string {
  const value = read(name)?.trim();
  if (!value) throw Error('Missing mail server setting: ' + name);
  return value;
}
function provider(read: EnvReader): string {
  return (read('EMAIL_PROVIDER') || 'resend').trim().toLowerCase();
}
export function mailDeliveryReady(read: EnvReader = currentEnv): boolean {
  const p = provider(read);
  const keys = p === 'gmail'
    ? ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'GMAIL_FROM_EMAIL']
    : p === 'resend' ? ['RESEND_API_KEY', 'RESEND_FROM_EMAIL'] : [];
  return keys.length > 0 && keys.every((key) => Boolean(read(key)?.trim()));
}
function checkedEmail(value: string): string {
  const email = value.trim();
  if (email.length > 254 || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email))
    throw Error('Invalid sender or recipient email');
  return email;
}
function encode64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function mimeBody(value: string): string {
  const encoded = encode64(value.replace(/\r\n?/g, '\n').replace(/\n/g, '\r\n'));
  return encoded.match(/.{1,76}/g)?.join('\r\n') || '';
}
function mimeMessage(from: string, to: string, subject: string, text: string, html?: string): string {
  // Encode UTF-8 subject in RFC 2047 encoded words, max 40 bytes each.
  const pieces: string[] = [];
  let part = '';
  for (const char of subject.replace(/[\r\n]/g, ' ')) {
    if (part && new TextEncoder().encode(part + char).length > 40) {
      pieces.push('=?UTF-8?B?' + encode64(part) + '?=');
      part = '';
    }
    part += char;
  }
  if (part) pieces.push('=?UTF-8?B?' + encode64(part) + '?=');
  const headers = [
    'From: <' + checkedEmail(from) + '>',
    'To: <' + checkedEmail(to) + '>',
    'Subject: ' + pieces.join('\r\n '),
    'MIME-Version: 1.0',
  ];
  if (!html) return [
    ...headers,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    mimeBody(text),
  ].join('\r\n');

  // A multipart/alternative message lets email clients render HTML or fall
  // back to readable text, without exposing HTML markup as plain text.
  const boundary = 'licits-alt-' + crypto.randomUUID();
  return [
    ...headers,
    'Content-Type: multipart/alternative; boundary="' + boundary + '"',
    '',
    '--' + boundary,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    mimeBody(text),
    '--' + boundary,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    mimeBody(html),
    '--' + boundary + '--',
    '',
  ].join('\r\n');
}
export async function sendConfiguredEmail(
  message: MailRequest,
  read: EnvReader = currentEnv,
  request: Fetcher = fetch,
): Promise<string> {
  const to = checkedEmail(message.to);
  if (!message.subject.trim() || !message.text.trim() || (message.html !== undefined && !message.html.trim())) throw Error('Missing email content');
  const p = provider(read);
  if (p === 'resend') {
    const headers: Record<string, string> = {
      Authorization: 'Bearer ' + required(read, 'RESEND_API_KEY'),
      'Content-Type': 'application/json',
    };
    if (message.idempotencyKey) headers['Idempotency-Key'] = message.idempotencyKey;
    const response = await request('https://api.resend.com/emails', {
      method: 'POST', headers,
      body: JSON.stringify({
        from: checkedEmail(required(read, 'RESEND_FROM_EMAIL')),
        to: [to], subject: message.subject, text: message.text,
        ...(message.html ? {html: message.html} : {}),
      }),
    });
    if (!response.ok) throw Error('Resend rejected the message: HTTP ' + response.status);
    const result = await response.json();
    if (typeof result?.id !== 'string' || !result.id) throw Error('Resend did not return a message id');
    return result.id;
  }
  if (p !== 'gmail') throw Error('Unsupported EMAIL_PROVIDER');
  const sender = checkedEmail(required(read, 'GMAIL_FROM_EMAIL'));
  const token = await request('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      client_id: required(read, 'GMAIL_CLIENT_ID'),
      client_secret: required(read, 'GMAIL_CLIENT_SECRET'),
      refresh_token: required(read, 'GMAIL_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
  });
  if (!token.ok) throw Error('Gmail authorization failed: HTTP ' + token.status);
  const auth = await token.json();
  if (typeof auth?.access_token !== 'string' || !auth.access_token)
    throw Error('Gmail authorization returned no access token');
  const raw = encode64(mimeMessage(sender, to, message.subject, message.text, message.html))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const response = await request('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {Authorization: 'Bearer ' + auth.access_token, 'Content-Type': 'application/json'},
    body: JSON.stringify({raw}),
  });
  if (!response.ok) throw Error('Gmail rejected the message: HTTP ' + response.status);
  const result = await response.json();
  if (typeof result?.id !== 'string' || !result.id) throw Error('Gmail did not return a message id');
  // Gmail's API does not provide Resend-style Idempotency-Key semantics.
  return result.id;
}
