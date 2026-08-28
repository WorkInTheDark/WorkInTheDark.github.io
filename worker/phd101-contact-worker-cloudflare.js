/**
 * PhD 101 contact form backend — pure Cloudflare, no third-party service.
 *
 * Sends through Cloudflare Email Routing's `send_email` binding, which can
 * deliver to any address you have verified as a Destination Address on the
 * account. That is exactly this use case: reader -> your inbox.
 *
 * No API keys, no vendor, no build step — paste this file into the Worker
 * editor and hit Deploy.
 *
 * Dashboard setup (see the notes in the chat for click-by-click):
 *   1. bingshengyao.com -> Email -> Email Routing -> enable
 *   2. Destination addresses -> add + verify your inbox
 *   3. this Worker -> Settings -> Bindings -> Email send
 *        variable name:       SEND
 *        destination address: your verified inbox
 *   4. this Worker -> Settings -> Variables and Secrets
 *        TO_ADDRESS    your verified inbox, e.g. b.yao@northeastern.edu
 *        FROM_ADDRESS  an address on the zone, e.g. phd101@bingshengyao.com
 *
 * The sender must be on a domain in your Cloudflare account; the recipient
 * must be a verified destination. The reader's own address rides along as
 * Reply-To, so hitting Reply answers them directly.
 */

import { EmailMessage } from 'cloudflare:email';

/* Only these origins may post. */
const ALLOWED_ORIGINS = [
  'https://www.bingshengyao.com',
  'https://bingshengyao.com',
  'https://workinthedark.github.io',
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      Vary: 'Origin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);
    if (!allowed) return json({ error: 'Forbidden' }, 403, cors);

    let form;
    try {
      form = await request.formData();
    } catch {
      return json({ error: 'Malformed request' }, 400, cors);
    }

    /* Honeypot: answer 200 so the bot believes it worked and moves on. */
    if (str(form.get('_gotcha'))) return json({ ok: true }, 200, cors);

    const name = str(form.get('name')).slice(0, 120);
    const email = str(form.get('email')).slice(0, 200);
    const message = str(form.get('message')).slice(0, 5000);
    const page = str(form.get('page')).slice(0, 300);

    if (!name || !email || !message) return json({ error: 'Please fill in every field.' }, 400, cors);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'That email does not look right.' }, 400, cors);

    const from = env.FROM_ADDRESS;
    const to = env.TO_ADDRESS;

    /* header() strips CR/LF: without it a crafted name or address could inject
     * extra headers into the message. */
    const raw = [
      `From: PhD 101 <${from}>`,
      `To: ${to}`,
      `Reply-To: ${header(name)} <${header(email)}>`,
      `Subject: ${header(`PhD 101 — message from ${name}`)}`,
      `Message-ID: <${crypto.randomUUID()}@${from.split('@')[1]}>`,
      `Date: ${new Date().toUTCString()}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="utf-8"',
      '',
      `From: ${name} <${email}>`,
      `Page: ${page}`,
      '',
      message,
      '',
    ].join('\r\n');

    try {
      await env.SEND.send(new EmailMessage(from, to, raw));
    } catch (error) {
      console.log('send_email failed', error && error.message);
      return json({ error: 'Could not send right now.' }, 502, cors);
    }

    return json({ ok: true }, 200, cors);
  },
};

function str(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function header(value) {
  return value.replace(/[\r\n]+/g, ' ');
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
