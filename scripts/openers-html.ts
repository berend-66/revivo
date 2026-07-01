/**
 * Render a batch of openers as a self-contained HTML worksheet — a nicer send
 * UX than the .txt: clickable "Stuur via WhatsApp" buttons (wa.me deep links),
 * a "Bekijk mockup" link, copy-to-clipboard, and a per-salon "verzonden"
 * checkbox that persists in localStorage (so closing the tab keeps progress).
 *
 * Pure templating, no deps — keeps scripts/build-openers.ts thin. The data
 * comes straight from buildOpener (@revivo/shared); this only formats it.
 */

export interface OpenerCard {
  /** mockup slug — stable id for the localStorage "sent" key. */
  slug: string;
  name: string;
  city?: string;
  /** full public mockup URL. */
  mockUrl: string;
  hook: string;
  /** canonical message (what the WhatsApp link carries). */
  plainText: string;
  /** compact one-paragraph variant for Instagram. */
  igDmText: string;
  /** wa.me deep link — present only for a Dutch mobile. */
  whatsappUrl?: string;
  /** landline/contact number to show when there is no WhatsApp. */
  phone?: string;
  /** the salon's source listing (Treatwell) — fallback contact route. */
  listingUrl?: string;
  /** verified Instagram handle (no @) or full profile URL — the IG-DM route. */
  instagram?: string;
  /** contact email address found via web search or listing. */
  email?: string;
  /** true when the salon has no own website (eerste-website angle). */
  noWebsite?: boolean;
}

/** Normalize a stored handle/URL into { handle, url } for the IG button. */
function instagramLink(raw?: string): { handle: string; url: string } | undefined {
  if (!raw) return undefined;
  const handle = raw
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "")
    .trim();
  if (!handle) return undefined;
  return { handle, url: `https://www.instagram.com/${handle}/` };
}

/** Text content (newlines preserved by CSS white-space: pre-wrap). */
function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Attribute value: also encode " and newlines (decoded back on getAttribute). */
function escAttr(s: string): string {
  return escHtml(s).replace(/"/g, "&quot;").replace(/\n/g, "&#10;");
}

function renderCard(c: OpenerCard): string {
  const sub = [c.city, `<a href="${escAttr(c.mockUrl)}" target="_blank" rel="noopener">/${escHtml(c.slug)} ↗</a>`]
    .filter(Boolean)
    .join(" · ");

  const ig = instagramLink(c.instagram);

  const pill = c.whatsappUrl
    ? `<span class="pill ok">WhatsApp</span>`
    : ig
      ? `<span class="pill ig">Instagram</span>`
      : `<span class="pill warn">Bellen</span>`;

  const waBtn = c.whatsappUrl
    ? `<a class="btn wa" href="${escAttr(c.whatsappUrl)}" target="_blank" rel="noopener">Stuur via WhatsApp</a>`
    : "";

  const igBtn = !c.whatsappUrl && ig
    ? `<a class="btn ig" href="${escAttr(ig.url)}" target="_blank" rel="noopener">Open Instagram · @${escHtml(ig.handle)}</a>`
    : "";

  const noMobileNote = c.whatsappUrl
    ? ""
    : `<p class="nomobile">Geen NL-mobiel. ${
        ig
          ? `Stuur via Instagram-DM (<b>@${escHtml(ig.handle)}</b>)`
          : "Geen Instagram gevonden"
      }${c.phone ? ` of bel <b>${escHtml(c.phone)}</b>` : ""}${
        !ig && c.listingUrl
          ? ` — <a href="${escAttr(c.listingUrl)}" target="_blank" rel="noopener">open Treatwell ↗</a>`
          : ""
      }. Kopieer het bericht hieronder en plak het in de DM.</p>`;

  // Email section — shown when an address is known
  const emailBtn = c.email
    ? (() => {
        const emailSubject = encodeURIComponent(
          c.noWebsite
            ? `Een website voor ${c.name} — klaar om te bekijken`
            : `Een nieuw voorbeeld voor ${c.name}`,
        );
        const emailBody = encodeURIComponent(c.igDmText + `\n\nBekijk hier: ${c.mockUrl}\n\nGroetjes,\nNelson`);
        return `<a class="btn email" href="mailto:${escAttr(c.email)}?subject=${emailSubject}&body=${emailBody}" target="_blank" rel="noopener">Stuur e-mail</a>`;
      })()
    : `<span class="btn ghost no-email" title="Geen e-mailadres gevonden">Geen e-mail</span>`;

  // WhatsApp carries the full text; IG/DM uses the compact one-paragraph variant.
  const copyText = c.whatsappUrl ? c.plainText : c.igDmText;
  const copyLabel = c.whatsappUrl ? "Kopieer bericht" : "Kopieer IG-bericht";

  return `<article class="card" data-id="${escAttr(c.slug)}">
  <header class="card-top">
    <div class="title">
      <h2>${escHtml(c.name)}</h2>
      <div class="meta">${sub}</div>
    </div>
    <div class="right">
      ${pill}
      <label class="sent"><input type="checkbox" class="sent-cb"> verzonden</label>
    </div>
  </header>
  <p class="hook">${escHtml(c.hook)}</p>
  <div class="msg">${escHtml(c.plainText)}</div>
  ${noMobileNote}
  <div class="actions">
    ${waBtn}
    ${igBtn}
    ${emailBtn}
    <a class="btn ghost" href="${escAttr(c.mockUrl)}" target="_blank" rel="noopener">Bekijk mockup</a>
    <button class="btn ghost copy-btn" data-copy="${escAttr(copyText)}">${copyLabel}</button>
  </div>
</article>`;
}

export function renderOpenersHtml(cards: OpenerCard[], opts?: { title?: string; baseHost?: string }): string {
  const title = opts?.title ?? "Revivo — outreach openers";
  const waCount = cards.filter((c) => c.whatsappUrl).length;
  const emailCount = cards.filter((c) => c.email).length;
  const subtitle =
    `${cards.length} salons · ${waCount} via WhatsApp · ${emailCount} met e-mail · ${cards.length - waCount} zonder mobiel` +
    (opts?.baseHost ? ` · links: ${escHtml(opts.baseHost)}` : "");

  const cardsHtml = cards.map(renderCard).join("\n");

  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escHtml(title)}</title>
<style>
  :root { --bordeaux:#3d0c0c; --cream:#f5efe0; --ink:#2a1410; --muted:#7a6a60; --line:#e7ddcd;
          --wa:#25d366; --wa-d:#128c4b; --ok:#1f7a4d; --warn:#9a6b15; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--cream); color:var(--ink);
         font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; line-height:1.5; }
  header.top { position:sticky; top:0; z-index:10; background:var(--bordeaux); color:var(--cream);
               padding:1rem 1.25rem; display:flex; align-items:center; justify-content:space-between;
               gap:1rem; flex-wrap:wrap; box-shadow:0 1px 0 rgba(0,0,0,.15); }
  header.top h1 { font-size:1.05rem; font-weight:600; margin:0; letter-spacing:.01em; }
  header.top .sub { color:#f5efe0b3; font-size:.82rem; margin-top:.15rem; }
  #counter { background:#f5efe01f; border:1px solid #f5efe033; color:var(--cream);
             padding:.35rem .7rem; border-radius:999px; font-size:.82rem; white-space:nowrap; }
  main { max-width:720px; margin:0 auto; padding:1.25rem; }
  .card { background:#fff; border:1px solid var(--line); border-radius:14px; padding:1.1rem 1.2rem;
          margin:0 0 1rem; box-shadow:0 1px 2px rgba(60,30,10,.04); transition:opacity .15s; }
  .card.done { opacity:.5; }
  .card-top { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; }
  .card-top h2 { font-size:1.15rem; margin:0; }
  .meta { color:var(--muted); font-size:.84rem; margin-top:.2rem; }
  .meta a { color:var(--muted); }
  .right { display:flex; flex-direction:column; align-items:flex-end; gap:.4rem; flex:none; }
  .pill { font-size:.7rem; font-weight:600; padding:.18rem .5rem; border-radius:999px; text-transform:uppercase; letter-spacing:.04em; }
  .pill.ok { background:#e4f3ea; color:var(--ok); }
  .pill.ig { background:#fce4ef; color:#c13584; }
  .pill.warn { background:#f6ecd6; color:var(--warn); }
  .sent { font-size:.8rem; color:var(--muted); display:flex; align-items:center; gap:.3rem; cursor:pointer; user-select:none; }
  .hook { font-style:italic; color:#5a463c; margin:.7rem 0 .55rem; }
  .msg { white-space:pre-wrap; background:var(--cream); border:1px solid var(--line); border-radius:10px;
         padding:.8rem .9rem; font-size:.9rem; }
  .nomobile { font-size:.84rem; color:var(--warn); background:#fbf4e3; border:1px solid #efe0bf;
              border-radius:8px; padding:.5rem .7rem; margin:.7rem 0 0; }
  .actions { display:flex; flex-wrap:wrap; gap:.55rem; margin-top:.85rem; }
  .btn { appearance:none; border:1px solid var(--line); background:#fff; color:var(--ink); cursor:pointer;
         font:inherit; font-size:.86rem; font-weight:500; padding:.5rem .85rem; border-radius:9px;
         text-decoration:none; display:inline-flex; align-items:center; gap:.35rem; }
  .btn:hover { border-color:#cdbfa8; }
  .btn.wa { background:var(--wa); border-color:var(--wa-d); color:#063; font-weight:600; }
  .btn.wa:hover { background:var(--wa-d); color:#fff; }
  .btn.ig { background:linear-gradient(45deg,#f09433,#dc2743,#bc1888); border-color:#bc1888; color:#fff; font-weight:600; }
  .btn.ig:hover { filter:brightness(1.08); }
  .btn.email { background:#1a56db; border-color:#1340a8; color:#fff; font-weight:600; }
  .btn.email:hover { background:#1340a8; }
  .btn.ghost:hover { background:var(--cream); }
  .no-email { opacity:.4; cursor:default; }
  footer { max-width:720px; margin:0 auto; padding:0 1.25rem 2.5rem; color:var(--muted); font-size:.82rem; }
  footer code { background:#fff; border:1px solid var(--line); border-radius:5px; padding:.1em .4em; }
</style>
</head>
<body>
<header class="top">
  <div>
    <h1>${escHtml(title)}</h1>
    <div class="sub">${subtitle}</div>
  </div>
  <div id="counter">0 / ${cards.length} verzonden</div>
</header>
<main>
${cardsHtml}
</main>
<footer>
  <p>Klik <b>Stuur via WhatsApp</b> → WhatsApp opent met bericht + mockup-link al ingevuld. Vink <b>verzonden</b> aan
  zodra je hebt verstuurd (blijft bewaard in deze browser). Markeer de leads daarna in de database met
  <code>pnpm build-openers --limit ${cards.length} --mark-sent</code>.</p>
</footer>
<script>
(function () {
  var KEY = "revivo-openers-sent";
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
  function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
  var state = load();
  var cards = Array.prototype.slice.call(document.querySelectorAll(".card"));
  var counter = document.getElementById("counter");
  function refresh() {
    var done = 0;
    cards.forEach(function (c) {
      var id = c.getAttribute("data-id");
      var cb = c.querySelector(".sent-cb");
      if (state[id]) { c.classList.add("done"); cb.checked = true; done++; }
      else { c.classList.remove("done"); cb.checked = false; }
    });
    counter.textContent = done + " / " + cards.length + " verzonden";
  }
  cards.forEach(function (c) {
    var cb = c.querySelector(".sent-cb");
    cb.addEventListener("change", function () {
      var id = c.getAttribute("data-id");
      if (cb.checked) state[id] = true; else delete state[id];
      save(state); refresh();
    });
  });
  document.querySelectorAll(".copy-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      navigator.clipboard.writeText(b.getAttribute("data-copy")).then(function () {
        var old = b.textContent; b.textContent = "✓ Gekopieerd";
        setTimeout(function () { b.textContent = old; }, 1500);
      });
    });
  });
  refresh();
})();
</script>
</body>
</html>
`;
}
