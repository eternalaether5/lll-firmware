/**
 * Vercel serverless: GET /api/confirm?token=...
 * Completes double opt-in: unsubscribed=false + topic opt_in.
 */

const SITES = {
  binrev: { brand: "BinRev Library", originEnv: "SITE_ORIGIN_BINREV", defaultOrigin: "https://binrev.lowlevellibrary.com" },
  exploit: { brand: "Exploit Library", originEnv: "SITE_ORIGIN_EXPLOIT", defaultOrigin: "https://exploit.lowlevellibrary.com" },
  firmware: { brand: "Firmware Library", originEnv: "SITE_ORIGIN_FIRMWARE", defaultOrigin: "https://firmware.lowlevellibrary.com" },
};

function envSegment(site) {
  const k = site.toUpperCase();
  return process.env[`RESEND_SEGMENT_ID_${k}`] || process.env[`RESEND_AUDIENCE_ID_${k}`];
}
function envTopic(site) {
  return process.env[`RESEND_TOPIC_ID_${site.toUpperCase()}`];
}

function htmlPage(origin, ok, message) {
  const title = ok ? "You are subscribed" : "Confirmation failed";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<meta name="color-scheme" content="light dark"><style>
:root{--bg:#f7f1e3;--paper:#fffdf7;--ink:#2a2118;--muted:#5f5143;--rule:#e2d6bf;--accent:#8a3b12;--serif:Georgia,serif;--sans:system-ui,sans-serif}
@media (prefers-color-scheme:dark){:root{--bg:#15120e;--paper:#1f1a15;--ink:#ede4d3;--muted:#b3a58f;--rule:#382f26;--accent:#ee9d5a}}
body{margin:0;background:var(--bg);color:var(--ink);font:1.075rem/1.7 var(--serif);padding:2rem 1.25rem}
main{max-width:40rem;margin:0 auto;background:var(--paper);border:1px solid var(--rule);border-left:4px solid var(--accent);border-radius:10px;padding:1.2rem 1.4rem}
a{color:var(--accent)}h1{font-family:var(--sans);font-size:1.4rem}
</style></head><body><main><h1>${title}</h1><p>${message}</p><p><a href="${origin}/">← Back to the library</a></p></main></body></html>`;
}

async function verifyToken(token) {
  const secret = process.env.CONFIRM_SECRET;
  if (!secret || !token || !token.includes(".")) return null;
  const [data, sigB64] = token.split(".");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    Buffer.from(sigB64, "base64url"),
    new TextEncoder().encode(data)
  );
  if (!ok) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const token = url.searchParams.get("token") || "";
  const payload = await verifyToken(token);
  if (!payload || !SITES[payload.site]) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(htmlPage("https://lowlevellibrary.com", false, "This confirmation link is invalid or expired."));
  }

  const meta = SITES[payload.site];
  const origin = process.env[meta.originEnv] || meta.defaultOrigin;
  const apiKey = process.env.RESEND_API_KEY;
  const segmentId = envSegment(payload.site);
  const topicId = envTopic(payload.site);

  if (!apiKey || !segmentId || !topicId) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(htmlPage(origin, false, "Confirmation is temporarily unavailable."));
  }

  // Activate contact
  const patch = await fetch(`https://api.resend.com/contacts/${encodeURIComponent(payload.email)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ unsubscribed: false }),
  });

  // Ensure segment membership (idempotent)
  await fetch(`https://api.resend.com/contacts/${encodeURIComponent(payload.email)}/segments/${segmentId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
  }).catch(() => {});

  // Topic opt-in
  const topicsRes = await fetch(`https://api.resend.com/contacts/${encodeURIComponent(payload.email)}/topics`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topics: [{ id: topicId, subscription: "opt_in" }],
    }),
  });

  if (!patch.ok || !topicsRes.ok) {
    console.error("confirm failed", patch.status, topicsRes.status);
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(htmlPage(origin, false, "Could not confirm the subscription. Please try signing up again."));
  }

  // Optional: send welcome email (template in templates/welcome.*)
  const from = process.env.RESEND_FROM || "The Low Level Librarian <updates@lowlevellibrary.com>";
  const unsub = `{{{RESEND_UNSUBSCRIBE_URL}}}`; // Resend broadcast merge; for transactional use preferences URL
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [payload.email],
      subject: `Welcome to ${meta.brand}`,
      html: `<p>You are confirmed for <strong>${meta.brand}</strong>.</p>
<p>We will occasionally email when we add free resources worth knowing about.</p>
<p><a href="${origin}/">Browse the directory</a></p>
<p>You can unsubscribe from future broadcasts via the link in those emails.</p>
<p>— The Low Level Librarian</p>`,
      text: `You are confirmed for ${meta.brand}.

Browse: ${origin}/

Unsubscribe links appear in every broadcast.

— The Low Level Librarian`,
    }),
  }).catch(() => {});

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(htmlPage(origin, true, `Thanks — you are subscribed to ${meta.brand}.`));
}
