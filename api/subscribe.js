/**
 * Vercel serverless: POST /api/subscribe
 * Draft only — copy into each sister site as api/subscribe.js (or shared package).
 *
 * Env:
 *   RESEND_API_KEY
 *   RESEND_SEGMENT_ID_BINREV | RESEND_SEGMENT_ID_EXPLOIT | RESEND_SEGMENT_ID_FIRMWARE
 *     (aliases: RESEND_AUDIENCE_ID_* still accepted; Resend Audiences → Segments)
 *   RESEND_TOPIC_ID_BINREV | RESEND_TOPIC_ID_EXPLOIT | RESEND_TOPIC_ID_FIRMWARE
 *   RESEND_FROM  e.g. "The Low Level Librarian <updates@lowlevellibrary.com>"
 *   CONFIRM_SECRET  HMAC secret for confirm tokens
 *   SITE_ORIGIN_BINREV / _EXPLOIT / _FIRMWARE  (canonical origins for confirm links)
 *
 * Double opt-in: create contact unsubscribed=true, email a confirm link.
 * Confirm handler (api/confirm.js) flips unsubscribed=false and topic opt_in.
 */

const SITES = {
  binrev: {
    brand: "BinRev Library",
    topic: "binary reverse engineering",
    originEnv: "SITE_ORIGIN_BINREV",
    defaultOrigin: "https://binrev.lowlevellibrary.com",
  },
  exploit: {
    brand: "Exploit Library",
    topic: "exploit development",
    originEnv: "SITE_ORIGIN_EXPLOIT",
    defaultOrigin: "https://exploit.lowlevellibrary.com",
  },
  firmware: {
    brand: "Firmware Library",
    topic: "embedded and IoT reversing",
    originEnv: "SITE_ORIGIN_FIRMWARE",
    defaultOrigin: "https://firmware.lowlevellibrary.com",
  },
};

function envSegment(site) {
  const k = site.toUpperCase();
  return process.env[`RESEND_SEGMENT_ID_${k}`] || process.env[`RESEND_AUDIENCE_ID_${k}`];
}
function envTopic(site) {
  return process.env[`RESEND_TOPIC_ID_${site.toUpperCase()}`];
}

function htmlEscape(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function parseBody(req) {
  // Vercel Node: raw body may be string; also support URL-encoded form posts (no-JS).
  if (typeof req.body === "string") {
    const params = new URLSearchParams(req.body);
    return Object.fromEntries(params.entries());
  }
  if (req.body && typeof req.body === "object") return req.body;
  return {};
}

function validEmail(email) {
  if (!email || email.length > 254) return false;
  // Practical check; Resend validates further.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function signToken(payload) {
  const secret = process.env.CONFIRM_SECRET;
  if (!secret) throw new Error("CONFIRM_SECRET missing");
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const sigB64 = Buffer.from(sig).toString("base64url");
  return `${data}.${sigB64}`;
}

function redirectOrHtml(res, origin, ok, message) {
  // No-JS friendly: return a small HTML page using site-like styling.
  const title = ok ? "Check your email" : "Could not subscribe";
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(title)}</title>
<meta name="color-scheme" content="light dark"><style>
:root{--bg:#f7f1e3;--paper:#fffdf7;--ink:#2a2118;--muted:#5f5143;--rule:#e2d6bf;--accent:#8a3b12;--serif:Georgia,serif;--sans:system-ui,sans-serif}
@media (prefers-color-scheme:dark){:root{--bg:#15120e;--paper:#1f1a15;--ink:#ede4d3;--muted:#b3a58f;--rule:#382f26;--accent:#ee9d5a}}
body{margin:0;background:var(--bg);color:var(--ink);font:1.075rem/1.7 var(--serif);padding:2rem 1.25rem}
main{max-width:40rem;margin:0 auto;background:var(--paper);border:1px solid var(--rule);border-left:4px solid var(--accent);border-radius:10px;padding:1.2rem 1.4rem}
a{color:var(--accent)}h1{font-family:var(--sans);font-size:1.4rem}
</style></head><body><main><h1>${htmlEscape(title)}</h1><p>${htmlEscape(message)}</p><p><a href="${htmlEscape(origin)}/">← Back to the library</a></p></main></body></html>`;
  res.statusCode = ok ? 200 : 400;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(body);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = parseBody(req);
  const site = String(body.site || "").toLowerCase();
  const meta = SITES[site];
  if (!meta) return redirectOrHtml(res, "https://lowlevellibrary.com", false, "Unknown site.");

  const origin = process.env[meta.originEnv] || meta.defaultOrigin;

  // Honeypot
  if (body.website) {
    // Pretend success so bots leave quietly.
    return redirectOrHtml(res, origin, true, "Thanks — if that address is real, check your inbox to confirm.");
  }

  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim().slice(0, 80);
  const consent = body.consent === "1" || body.consent === "on" || body.consent === true;

  if (!consent) return redirectOrHtml(res, origin, false, "Please check the consent box to subscribe.");
  if (!validEmail(email)) return redirectOrHtml(res, origin, false, "That email address does not look valid.");

  const apiKey = process.env.RESEND_API_KEY;
  const segmentId = envSegment(site);
  const topicId = envTopic(site);
  const from = process.env.RESEND_FROM || "The Low Level Librarian <updates@lowlevellibrary.com>";

  if (!apiKey || !segmentId || !topicId || !process.env.CONFIRM_SECRET) {
    console.error("Missing RESEND_API_KEY, segment/topic id, or CONFIRM_SECRET");
    return redirectOrHtml(res, origin, false, "Subscriptions are temporarily unavailable. Please try again later.");
  }

  // Create (or upsert) contact as unsubscribed until they confirm.
  // Resend contacts API (segments + topics). Topic stays opt_out until confirm.
  const createRes = await fetch("https://api.resend.com/contacts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      first_name: name || undefined,
      unsubscribed: true,
      segments: [{ id: segmentId }],
      topics: [{ id: topicId, subscription: "opt_out" }],
      properties: {
        source_site: site,
        consent_at: new Date().toISOString(),
      },
    }),
  });

  // 409 / already exists: still send confirm if they were never confirmed.
  if (!createRes.ok && createRes.status !== 409) {
    const errText = await createRes.text();
    console.error("Resend create contact failed", createRes.status, errText);
    return redirectOrHtml(res, origin, false, "Could not start the subscription. Please try again later.");
  }

  const exp = Date.now() + 1000 * 60 * 60 * 48; // 48h
  const token = await signToken({ email, site, exp });
  const confirmUrl = `${origin}/api/confirm?token=${encodeURIComponent(token)}`;

  const subject = `Confirm your ${meta.brand} subscription`;
  const html = `<p>Hi${name ? ` ${htmlEscape(name)}` : ""},</p>
<p>Please confirm you want occasional updates from <strong>${htmlEscape(meta.brand)}</strong> about free ${htmlEscape(meta.topic)} resources.</p>
<p><a href="${htmlEscape(confirmUrl)}">Confirm subscription</a></p>
<p>This link expires in 48 hours. If you did not request this, you can ignore this email.</p>
<p>— The Low Level Librarian</p>`;
  const text = `Hi${name ? ` ${name}` : ""},

Please confirm you want occasional updates from ${meta.brand} about free ${meta.topic} resources.

Confirm: ${confirmUrl}

This link expires in 48 hours. If you did not request this, ignore this email.

— The Low Level Librarian`;

  const sendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [email], subject, html, text }),
  });

  if (!sendRes.ok) {
    const errText = await sendRes.text();
    console.error("Resend send failed", sendRes.status, errText);
    const unverified = /domain|verify|not.?verified|from|invalid/i.test(errText);
    const msg = unverified
      ? "Subscriptions are almost ready — our sending domain is still being verified. Please try again in a little while."
      : "Could not send the confirmation email. Please try again later.";
    return redirectOrHtml(res, origin, false, msg);
  }

  return redirectOrHtml(
    res,
    origin,
    true,
    "Almost done — check your inbox for a confirmation link. (Check spam if you do not see it.)"
  );
}
