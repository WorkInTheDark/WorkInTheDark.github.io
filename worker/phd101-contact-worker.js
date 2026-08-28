/**
 * PhD 101 contact form backend — a Cloudflare Worker.
 *
 * Receives the form POSTed by _includes/phd101_contact.html and relays it to
 * your inbox through Resend's HTTP API. No build step: paste this whole file
 * into the Cloudflare dashboard's Worker editor and hit Deploy.
 *
 * Environment (Worker → Settings → Variables and Secrets):
 *   RESEND_API_KEY   secret   API key from resend.com
 *   TO_ADDRESS       plain    where messages land, e.g. b.yao@northeastern.edu
 *   FROM_ADDRESS     plain    a verified sender, e.g. PhD 101 <phd101@yourdomain.com>
 *
 * Then put this Worker's URL in _config.yml under phd101_contact.endpoint.
 */

/* Only these origins may post. Add your custom domain here if the site moves. */
const ALLOWED_ORIGINS = [
  'https://www.bingshengyao.com',   // where the site is actually served
  'https://bingshengyao.com',       // apex, which redirects to www
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
      'Vary': 'Origin',
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

    /* Honeypot: answer 200 so the bot believes it succeeded and moves on. */
    if (str(form.get('_gotcha'))) return json({ ok: true }, 200, cors);

    const name = str(form.get('name')).slice(0, 120);
    const email = str(form.get('email')).slice(0, 200);
    const message = str(form.get('message')).slice(0, 5000);
    const page = str(form.get('page')).slice(0, 300);

    if (!name || !email || !message) return json({ error: 'Please fill in every field.' }, 400, cors);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'That email does not look right.' }, 400, cors);

    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.FROM_ADDRESS,
        to: [env.TO_ADDRESS],
        /* So hitting Reply in your mail client answers the reader directly. */
        reply_to: email,
        subject: `PhD 101 — message from ${name}`,
        text: `From: ${name} <${email}>\nPage: ${page}\n\n${message}\n`,
      }),
    });

    if (!sent.ok) {
      console.log('resend failed', sent.status, await sent.text());
      return json({ error: 'Could not send right now.' }, 502, cors);
    }

    return json({ ok: true }, 200, cors);
  },
};

function str(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
