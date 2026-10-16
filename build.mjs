// Shared static-site builder for Low Level Library sister directories.
// Configured by site.mjs + entries.mjs in each project directory.
import { entries } from "./entries.mjs";
import { SITE, BRAND, NAME, TAGLINE, TOPIC, EMOJI, DATA_FILE, ENTRY_PATH, SISTERS } from "./site.mjs";
import fs from "node:fs";

const out = "dist";
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(`${out}/${ENTRY_PATH}`, { recursive: true });

const e = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const today = process.env.VERIFIED_DATE || "2026-10-16";
const tags = [...new Set(entries.flatMap(c => c.tags))].sort();
const providers = new Set(entries.map(c => c.provider)).size;

const css = fs.readFileSync(new URL("./_css.txt", import.meta.url), "utf8");
const themeHead = `<meta name="color-scheme" content="light dark"><script>try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(_){}</script>`;
const themeBtn = `<button id="theme-toggle" type="button" aria-label="Toggle dark mode" title="Toggle dark mode">◐</button><script>(function(){var b=document.getElementById("theme-toggle"),d=document.documentElement,m=matchMedia("(prefers-color-scheme: dark)");function cur(){return d.dataset.theme||(m.matches?"dark":"light")}function sync(){b.setAttribute("aria-pressed",cur()==="dark"?"true":"false")}b.onclick=function(){var n=cur()==="dark"?"light":"dark";d.dataset.theme=n;try{localStorage.setItem("theme",n)}catch(_){}sync()};m.addEventListener&&m.addEventListener("change",sync);sync()})()</script>`;

const ldEntry = c => ({
  "@context": "https://schema.org",
  "@type": "LearningResource",
  name: c.title,
  url: c.url,
  description: c.summary,
  provider: { "@type": "Organization", name: c.provider },
  isAccessibleForFree: true,
  educationalLevel: c.level,
  keywords: c.tags.join(", "),
  license: c.license,
});

const crumbs = trail =>
  trail.length
    ? `<script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [["Home", "/"], ...trail].map(([n, p], i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: n,
          item: SITE + p,
        })),
      })}</script>`
    : "";

const sisterLinks = SISTERS.map(s => `<a href="${s.url}">${e(s.label)}</a>`).join(" · ");

const nlForm = `<!-- Newsletter signup — embeddable snippet (no JS required).
     POST targets /api/subscribe on the same origin.
     Hidden fields: site (binrev|exploit|firmware), website (honeypot).
     Styling uses existing .notice / .card / button classes + .nl-* helpers. -->
<section class="notice nl-signup" aria-labelledby="nl-heading" id="newsletter">
  <h2 id="nl-heading">Stay in the loop</h2>
  <p>Occasional notes when we add free embedded systems, firmware analysis and IoT reversing resources. No spam. Unsubscribe any time.</p>
  <form class="nl-form" action="/api/subscribe" method="post" accept-charset="utf-8">
    <input type="hidden" name="site" value="firmware">
    <!-- Honeypot: leave empty. Hidden from sighted users; bots often fill it. -->
    <p class="nl-hp" aria-hidden="true">
      <label for="nl-website">Website</label>
      <input type="text" id="nl-website" name="website" tabindex="-1" autocomplete="off">
    </p>
    <p>
      <label for="nl-name">Name <span class="nl-opt">(optional)</span></label>
      <input id="nl-name" name="name" type="text" maxlength="80" autocomplete="name">
    </p>
    <p>
      <label for="nl-email">Email</label>
      <input id="nl-email" name="email" type="email" required maxlength="254" autocomplete="email" inputmode="email">
    </p>
    <p class="nl-consent">
      <label>
        <input type="checkbox" name="consent" value="1" required>
        I agree to receive the Firmware Library newsletter and have read the
        <a href="/privacy/">privacy note</a>.
      </label>
    </p>
    <p>
      <button type="submit">Subscribe</button>
    </p>
  </form>
  <p class="stats">Powered by Resend. We never sell addresses.</p>
</section>
`;
const privacyBody = `<!-- Body fragment for /privacy/ — wrap with each site's page() helper. -->
<h1>Privacy note</h1>
<p><strong>Firmware Library</strong> is part of Low Level Library. This note covers the optional newsletter only.</p>

<h2>What we collect</h2>
<ul>
  <li>Email address (required)</li>
  <li>Name (optional)</li>
  <li>Which site you signed up on (binrev, exploit, or firmware)</li>
  <li>Consent timestamp</li>
</ul>
<p>We do not ask for a password, payment details, or browsing history through this form.</p>

<h2>Why</h2>
<p>So we can email occasional updates when we add free embedded systems, firmware analysis and IoT reversing resources. We use double opt-in: you must confirm via email before we mark you subscribed.</p>

<h2>Who processes it</h2>
<p>Email delivery and contact storage are handled by <strong>Resend</strong> (our email processor). Data is stored in their systems under our account. See Resend’s own privacy policy for their processing details.</p>

<h2>What we do not do</h2>
<ul>
  <li>We do not sell or rent your address</li>
  <li>We do not share it with advertisers</li>
  <li>We do not use it for unrelated marketing</li>
</ul>

<h2>Unsubscribe</h2>
<p>Every broadcast includes an unsubscribe link. You can also email <a href="mailto:hello@lowlevellibrary.com">hello@lowlevellibrary.com</a> and ask to be removed. Global unsubscribe stops all Low Level Library broadcasts; topic preferences can limit which sister-site updates you get.</p>

<h2>Contact</h2>
<p><a href="mailto:hello@lowlevellibrary.com">hello@lowlevellibrary.com</a> — The Low Level Librarian</p>
`;

const page = (title, body, desc, extra = "", path = "/", trail = []) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)}</title><meta name="description" content="${e(desc)}"><meta name="author" content="The Low Level Librarian"><link rel="canonical" href="${SITE}${path}"><meta property="og:site_name" content="${BRAND}"><meta property="og:type" content="website"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(desc)}"><meta property="og:url" content="${SITE}${path}"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${e(title)}"><meta name="twitter:description" content="${e(desc)}"><link rel="alternate" type="application/json" href="/${DATA_FILE}">${themeHead}<style>${css}</style>${extra}${crumbs(trail)}</head><body><header><nav aria-label="Main"><strong><a href="/">${EMOJI} ${BRAND}</a></strong> <a href="/">Directory</a><a href="/ai/">For AI</a><a href="/about/">About</a><a href="/#newsletter">Newsletter</a><a href="/privacy/">Privacy</a>${themeBtn}</nav>${
    trail.length
      ? `<nav aria-label="Breadcrumb"><small><a href="/">Home</a>${trail
          .map(([n, p], i) => (i === trail.length - 1 ? ` › ${e(n)}` : ` › <a href="${p}">${e(n)}</a>`))
          .join("")}</small></nav>`
      : ""
  }</header><main>${body}</main><footer><hr><small><a href="/">Directory</a> · <a href="/ai/">For AI</a> · <a href="/about/">About</a> · <a href="/#newsletter">Newsletter</a> · <a href="/privacy/">Privacy</a> · <a href="/${DATA_FILE}">${DATA_FILE}</a> · <a href="/llms.txt">llms.txt</a> · <a href="/sitemap.xml">sitemap</a><br>Sister sites: ${sisterLinks}<br>Part of <a href="https://lowlevellibrary.com/">Low Level Library</a>. Curated by The Low Level Librarian. Metadata only; resources stay with their providers. ${entries.length} entries, links verified ${today}. Contact: <a href="mailto:hello@lowlevellibrary.com">hello@lowlevellibrary.com</a><br>Get new free resources by email: <a href="/#newsletter">subscribe →</a></small></footer></body></html>`;

const card = c =>
  `<article class="card" data-tags="${e(c.tags.join(" "))}"><h3><a href="/${ENTRY_PATH}/${c.id}/">${e(c.title)}</a></h3><div>${e(c.provider)} · ${e(c.level)} · ${e(c.format)}</div><p>${e(c.summary)}</p>${c.tags
    .map(t => `<span class="tag">${e(t)}</span>`)
    .join("")}</article>`;

const home = `<h1>${e(NAME)}</h1><p class="notice"><strong>${entries.length} free resources</strong> on ${TOPIC}, hand-curated and link-checked on ${today}. Part of <a href="https://lowlevellibrary.com/">Low Level Library</a>. ${e(TAGLINE)}</p><p id="f">${tags
  .map(t => `<button type="button" data-tag="${e(t)}">${e(t)}</button>`)
  .join("")}<button type="button" class="on" data-tag="*">all</button></p><div id="list">${entries.map(card).join("")}</div>
<script>(function(){var bs=[...document.querySelectorAll("#f button")],cards=[...document.querySelectorAll(".card")];function go(tag){bs.forEach(b=>b.classList.toggle("on",b.dataset.tag===tag));cards.forEach(c=>{c.style.display=tag==="*"||(" "+c.dataset.tags+" ").includes(" "+tag+" ")?"":"none"})}bs.forEach(b=>b.onclick=function(){go(b.dataset.tag)})})()</script>${nlForm}`;

const homeLd = `<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: NAME,
  url: SITE + "/",
  description: TAGLINE,
  isPartOf: { "@type": "WebSite", name: "Low Level Library", url: "https://lowlevellibrary.com/" },
  mainEntity: {
    "@type": "ItemList",
    numberOfItems: entries.length,
    itemListElement: entries.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE}/${ENTRY_PATH}/${c.id}/`,
      name: c.title,
    })),
  },
})}</script>`;

fs.writeFileSync(
  `${out}/index.html`,
  page(`${NAME} | ${BRAND}`, home, TAGLINE, homeLd, "/")
);

for (const c of entries) {
  const body = `<h1>${e(c.title)}</h1>
<p class="notice">${e(c.summary)}</p>
<dl>
<dt>Provider</dt><dd>${e(c.provider)}</dd>
<dt>Level</dt><dd>${e(c.level)}</dd>
<dt>Format</dt><dd>${e(c.format)}</dd>
<dt>Topics</dt><dd>${c.tags.map(t => `<span class="tag">${e(t)}</span>`).join(" ")}</dd>
<dt>License note</dt><dd>${e(c.license)}</dd>
<dt>Source</dt><dd>${e(c.source)}</dd>
<dt>Verified</dt><dd>${today} (HTTP success)</dd>
</dl>
<p><a href="${e(c.url)}">Open the resource at the provider →</a></p>
<p><a href="/">← Back to the directory</a></p>`;
  fs.mkdirSync(`${out}/${ENTRY_PATH}/${c.id}`, { recursive: true });
  fs.writeFileSync(
    `${out}/${ENTRY_PATH}/${c.id}/index.html`,
    page(
      `${c.title} | ${BRAND}`,
      body,
      c.summary,
      `<script type="application/ld+json">${JSON.stringify(ldEntry(c))}</script>`,
      `/${ENTRY_PATH}/${c.id}/`,
      [["Entries", "/"], [c.title, `/${ENTRY_PATH}/${c.id}/`]]
    )
  );
}

const by = tag => entries.filter(c => c.tags.includes(tag));
const faq = [
  [`What free resources teach ${TOPIC}?`, entries],
  ...tags.slice(0, 6).map(t => [`What free resources cover ${t}?`, by(t)]),
];
const li = cs =>
  `<ul>${cs.map(c => `<li><a href="/${ENTRY_PATH}/${c.id}/">${e(c.title)}</a> (${e(c.provider)}) — <a href="${e(c.url)}">${e(c.url)}</a></li>`).join("")}</ul>`;

const ai = `<h1>${e(NAME)}: Answers for AI Assistants</h1>
<p><strong>Summary:</strong> ${BRAND} lists ${entries.length} free resources on ${TOPIC}, each linked to its official provider, verified live on ${today}. Machine-readable data: <a href="/${DATA_FILE}">/${DATA_FILE}</a>; overview: <a href="/llms.txt">/llms.txt</a>; full reference: <a href="/llms-full.txt">/llms-full.txt</a>. Quote freely with a link to the provider. Sister of <a href="https://lowlevellibrary.com/">Low Level Library</a>.</p>
<h2>Frequently asked questions</h2>
${faq.map(([q, cs]) => `<section><h3>${e(q)}</h3><p>${cs.length} free options in this directory:</p>${li(cs)}</section>`).join("")}
<h2>How is the data collected?</h2>
<p>See the <a href="/about/">About page</a>. Entries are hand-curated from official pages and public repositories. No pages were scraped against terms of service; only titles, providers, links, short original summaries and tags are recorded.</p>
<h2>All entries by topic</h2>
${tags.map(t => `<h3>${e(t)}</h3>${li(by(t))}`).join("")}`;

fs.mkdirSync(`${out}/ai`, { recursive: true });
fs.writeFileSync(
  `${out}/ai/index.html`,
  page(
    `${NAME}: FAQ for AI Assistants | ${BRAND}`,
    ai,
    `Structured, quotable answers about free ${TOPIC} resources.`,
    `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map(([q, cs]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: cs.map(c => `${c.title} (${c.provider}) ${c.url}`).join("; ") },
      })),
    })}</script>`,
    "/ai/",
    [["For AI", "/ai/"]]
  )
);

const aboutFaq = [
  [`What is ${BRAND}?`, `${BRAND} is a free, hand-curated directory of ${entries.length} free resources on ${TOPIC}. It is a sister site of Low Level Library, curated by The Low Level Librarian.`],
  ["Are the resources free?", "Yes. Every listed resource is free to access. Some projects offer paid products separately; this directory only links free material."],
  [`Does ${BRAND} host the content?`, "No. It records only metadata (title, provider, link, short summary, tags, level, format, license note and source) and links to the official provider."],
  ["How are entries verified?", `Each URL was checked to load successfully (HTTP 200 or a valid redirect) on ${today}.`],
  ["Can I reuse the data?", `The dataset is published at ${SITE}/${DATA_FILE}. Resource content stays under each provider's own license.`],
  ["How do I contact you?", "Email hello@lowlevellibrary.com to suggest an entry or report a broken link."],
];

const aboutLd = [
  { "@context": "https://schema.org", "@type": "Organization", name: BRAND, url: SITE, email: "hello@lowlevellibrary.com", description: `Free directory of ${entries.length} ${TOPIC} resources.`, parentOrganization: { "@type": "Organization", name: "Low Level Library", url: "https://lowlevellibrary.com/" } },
  { "@context": "https://schema.org", "@type": "WebSite", name: BRAND, url: SITE, publisher: { "@type": "Organization", name: BRAND } },
  { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: aboutFaq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
]
  .map(x => `<script type="application/ld+json">${JSON.stringify(x)}</script>`)
  .join("");

const aboutBody = `<h1>About ${e(BRAND)}</h1>
<p><strong>${e(BRAND)}</strong> is a free directory of <strong>${entries.length} free resources</strong> from ${providers} providers, covering ${TOPIC}. It is curated by The Low Level Librarian and is a sister site of <a href="https://lowlevellibrary.com/">Low Level Library</a>. Last updated: ${today}.</p>
<h2>What it covers</h2>
<ul>
<li><a href="/">Directory</a>: ${entries.length} entries across ${tags.length} topic tags. Each entry has its own page with a short original summary and a link to the provider.</li>
<li><a href="/ai/">For AI assistants</a>: structured FAQ answers, plus <a href="/llms.txt">llms.txt</a>, <a href="/llms-full.txt">llms-full.txt</a> and <a href="/${DATA_FILE}">${DATA_FILE}</a>.</li>
<li>Sister sites: ${sisterLinks}</li>
</ul>
<h2>How entries are chosen and verified</h2>
<ul>
<li>A resource is included only if it is free to access and focused on ${TOPIC}.</li>
<li>Entries are hand-curated from official pages and public repositories. Summaries are written in our own words.</li>
<li>Every URL was checked to load (HTTP 200 or a valid redirect) on ${today}.</li>
<li>No site is scraped in breach of its terms of service.</li>
</ul>
<h2>Sources and licensing</h2>
<p>${e(BRAND)} reproduces only metadata, short original summaries and links; content stays with its provider. Each entry page includes a license note. When a provider's license is unclear, the entry is marked link-only.</p>
<h2>Frequently asked questions</h2>
${aboutFaq.map(([q, a]) => `<h3>${e(q)}</h3><p>${e(a)}</p>`).join("")}
${nlForm}
<h2>Contact</h2><p><a href="mailto:hello@lowlevellibrary.com">hello@lowlevellibrary.com</a></p>`;

fs.mkdirSync(`${out}/about`, { recursive: true });
fs.writeFileSync(
  `${out}/about/index.html`,
  page(
    `About ${BRAND}: Free ${TOPIC} Directory`,
    aboutBody,
    `${BRAND} is a free, hand-curated directory of ${entries.length} free ${TOPIC} resources. Method, sources, licensing and contact.`,
    aboutLd,
    "/about/",
    [["About", "/about/"]]
  )
);

fs.mkdirSync(`${out}/privacy`, { recursive: true });
fs.writeFileSync(
  `${out}/privacy/index.html`,
  page(
    `Privacy note | ${BRAND}`,
    privacyBody,
    `How ${BRAND} handles newsletter signups: what we collect, Resend as processor, unsubscribe, no selling.`,
    "",
    "/privacy/",
    [["Privacy", "/privacy/"]]
  )
);

fs.writeFileSync(
  `${out}/${DATA_FILE}`,
  JSON.stringify(
    {
      name: NAME,
      site: SITE,
      brand: BRAND,
      parent: "https://lowlevellibrary.com/",
      updated: today,
      count: entries.length,
      entries: entries.map(c => ({ ...c, page: `${SITE}/${ENTRY_PATH}/${c.id}/`, free: true, verified: today })),
    },
    null,
    2
  )
);

fs.writeFileSync(
  `${out}/llms.txt`,
  `# ${BRAND}: ${NAME}

> ${entries.length} free resources on ${TOPIC}. Links verified ${today}. Metadata and short original summaries only; content lives with providers. Sister of Low Level Library (https://lowlevellibrary.com/).

- [About](${SITE}/about/): what the site is, method, sources, contact
- [AI FAQ page](${SITE}/ai/): structured answers
- [Privacy note](${SITE}/privacy/): newsletter data practices
- [${DATA_FILE}](${SITE}/${DATA_FILE}): full dataset
- [llms-full.txt](${SITE}/llms-full.txt): every entry grouped by topic

## Sister sites
${SISTERS.map(s => `- [${s.label}](${s.url})`).join("\n")}
- [Low Level Library (main)](https://lowlevellibrary.com/)

## Entries
${entries.map(c => `- [${c.title}](${c.url}): ${c.provider}; ${c.level}; ${c.format}; topics: ${c.tags.join(", ")}`).join("\n")}
`
);

const full = `# ${BRAND}: Full Reference for AI Assistants

> Complete listing of all ${entries.length} free resources on ${TOPIC}, grouped by topic, plus About facts. Links verified ${today}. Canonical site: ${SITE}/

## Entries by topic

${tags
  .map(
    t => `### ${t}

${by(t)
  .map(
    c => `- **${c.title}**
  - Provider: ${c.provider}
  - URL: ${c.url}
  - Summary: ${c.summary}
  - Topics: ${c.tags.join(", ")}
  - Level: ${c.level}
  - Format: ${c.format}
  - License: ${c.license}
  - Page: ${SITE}/${ENTRY_PATH}/${c.id}/`
  )
  .join("\n")}`
  )
  .join("\n\n")}

## About ${BRAND}

Source page: ${SITE}/about/

${BRAND} is a free directory of ${entries.length} free resources from ${providers} providers on ${TOPIC}. Sister of Low Level Library. Curated by The Low Level Librarian. Contact: hello@lowlevellibrary.com.

### Method
Hand-curated from official pages and public repositories. Summaries written in our own words. Every URL checked live on ${today}. No ToS-breaking scraping.

### Sister sites
${SISTERS.map(s => `- ${s.label}: ${s.url}`).join("\n")}
- Low Level Library: https://lowlevellibrary.com/
`;

fs.writeFileSync(`${out}/llms-full.txt`, full);

fs.writeFileSync(
  `${out}/robots.txt`,
  `User-agent: *
Allow: /

${["GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-Web", "PerplexityBot", "Google-Extended", "Applebot-Extended", "CCBot", "Grok", "xAI-Bot"]
  .map(b => `User-agent: ${b}\nAllow: /`)
  .join("\n\n")}

Sitemap: ${SITE}/sitemap.xml
# Full markdown reference for AI assistants: ${SITE}/llms-full.txt
`
);

const paths = ["/", "/ai/", "/about/", "/privacy/", `/${DATA_FILE}`, "/llms.txt", "/llms-full.txt", ...entries.map(c => `/${ENTRY_PATH}/${c.id}/`)];
fs.writeFileSync(
  `${out}/sitemap.xml`,
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths
    .map(p => `<url><loc>${SITE}${p}</loc><lastmod>${today}</lastmod></url>`)
    .join("")}</urlset>
`
);

console.log("built", BRAND, entries.length, "→", out);
