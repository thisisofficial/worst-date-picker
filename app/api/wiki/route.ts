import { NextRequest } from "next/server";
import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";

export const dynamic = "force-dynamic";

type Stage = "day" | "month" | "year";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isStage(v: string | null): v is Stage {
  return v === "day" || v === "month" || v === "year";
}

async function getRandomTitle(): Promise<string> {
  try {
    const res = await fetch(
      "https://en.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=1&format=json",
      { headers: { "User-Agent": "worst-date-picker/1.0" } }
    );
    if (!res.ok) throw new Error(`Upstream ${res.status}`);
    const data = await res.json();
    const title = data?.query?.random?.[0]?.title as string | undefined;
    return title ?? "Wikipedia";
  } catch {
    return "Wikipedia";
  }
}

// Wraps every standalone number/month-name in loose text nodes with a
// clickable element that posts the chosen value up to the parent window.
function annotateValues($: cheerio.CheerioAPI, stage: Stage) {
  // Day and year: every number on the page is clickable — day validates the
  // range itself, year is built one digit at a time from whatever gets clicked.
  // Month: month names, plus 1-12 which get translated to a month client-side.
  const pattern =
    stage === "month"
      ? new RegExp(`\\b(${MONTHS.join("|")}|1[0-2]|[1-9])\\b`, "g")
      : /\b(\d+)\b/g;

  const body = $("body").get(0);
  if (!body) return;

  const walk = (node: AnyNode) => {
    const el = $(node);
    if (node.type === "tag") {
      const tag = (node as Element).tagName?.toLowerCase();
      if (tag === "a" || tag === "script" || tag === "style" || tag === "textarea") return;
      el.contents().each((_, child) => walk(child));
      return;
    }
    if (node.type === "text") {
      const text = (node as unknown as { data: string }).data;
      if (!text || !pattern.test(text)) return;
      pattern.lastIndex = 0;

      const pieces: string[] = [];
      let last = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text))) {
        const value = match[1];
        pieces.push(escapeHtml(text.slice(last, match.index)));
        pieces.push(renderToken(value, stage));
        last = match.index + match[0].length;
      }
      pieces.push(escapeHtml(text.slice(last)));
      $(node).replaceWith(pieces.join(""));
    }
  };

  $(body)
    .contents()
    .each((_, child) => walk(child));
}

// Value always travels up as the raw string token; the parent window decides
// how to interpret it per-stage (range check, digit-of-year, etc). Year-stage
// exception: a small, random slice of the 4-digit numbers on any given page
// are rendered disabled, as if "under maintenance" — arbitrary, and specific
// to this page load only.
function renderToken(value: string, stage: Stage): string {
  if (stage === "year" && /^\d{4}$/.test(value) && Math.random() < 0.15) {
    return `<span class="dp-disabled" title="This year is temporarily unavailable due to scheduled maintenance.">${escapeHtml(
      value
    )}</span>`;
  }
  return `<a href="#" class="dp-pick" data-value="${escapeHtml(
    value
  )}" onclick="event.preventDefault();event.stopPropagation();parent.postMessage({type:'dp-select',stage:'${stage}',value:this.dataset.value},'*');return false;">${escapeHtml(
    value
  )}</a>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function rewriteLinks($: cheerio.CheerioAPI, stage: Stage) {
  $("a[href]").each((_, node) => {
    const el = $(node);
    if (el.hasClass("dp-pick")) return;
    let href = el.attr("href") ?? "";

    if (href.startsWith("#")) return; // same-page anchor, leave it

    if (href.startsWith("./")) {
      const title = decodeURIComponent(href.slice(2).split("#")[0]);
      el.attr(
        "href",
        `/api/wiki?title=${encodeURIComponent(title)}&stage=${stage}`
      );
      el.removeAttr("target");
      return;
    }

    if (href.startsWith("//")) href = "https:" + href;
    if (/^https?:\/\/(\w+\.)?wikipedia\.org\//i.test(href)) {
      try {
        const u = new URL(href);
        const m = u.pathname.match(/^\/wiki\/(.+)$/);
        if (m) {
          const title = decodeURIComponent(m[1]);
          el.attr(
            "href",
            `/api/wiki?title=${encodeURIComponent(title)}&stage=${stage}`
          );
          return;
        }
      } catch {
        // fall through to external handling
      }
    }

    // Anything else (external site) — let it escape the sandbox in a new tab
    // so the iframe itself never navigates off-proxy.
    el.attr("href", href);
    el.attr("target", "_blank");
    el.attr("rel", "noopener noreferrer");
  });

  $("img[src]").each((_, node) => {
    const el = $(node);
    const src = el.attr("src") ?? "";
    if (src.startsWith("//")) el.attr("src", "https:" + src);
  });
  $("img[srcset]").each((_, node) => {
    const el = $(node);
    const srcset = el.attr("srcset") ?? "";
    el.attr("srcset", srcset.replace(/\/\//g, "https://"));
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const stageParam = searchParams.get("stage");
  const stage: Stage = isStage(stageParam) ? stageParam : "day";
  let title = searchParams.get("title");

  if (!title) {
    title = await getRandomTitle();
  }

  let html = "";
  const resolvedTitle = title;
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(
        title.replace(/ /g, "_")
      )}`,
      { headers: { "User-Agent": "worst-date-picker/1.0" } }
    );
    if (!res.ok) throw new Error(`Upstream ${res.status}`);
    html = await res.text();
  } catch {
    return new Response(
      renderShell(
        stage,
        resolvedTitle,
        `<p class="dp-error">This page wouldn't load. <a href="/api/wiki?stage=${stage}">Try another random page</a>.</p>`
      ),
      { headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }

  const $ = cheerio.load(html);
  annotateValues($, stage);
  rewriteLinks($, stage);

  const heading = $("head title").text() || resolvedTitle;
  const body = $("body").html() ?? "";

  return new Response(renderShell(stage, heading, body), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function renderShell(stage: Stage, title: string, bodyHtml: string) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} - Wikipedia</title>
<style>
  body {
    font-family: sans-serif;
    line-height: 1.6;
    color: #202122;
    background: #fff;
    margin: 0;
    padding: 16px 20px 60px;
  }
  h1, h2, h3 { font-family: Georgia, serif; border-bottom: 1px solid #a2a9b1; padding-bottom: 4px; }
  a { color: #0645ad; text-decoration: none; }
  a:hover { text-decoration: underline; }
  a.dp-pick {
    background: #fff2a8;
    color: #202122;
    font-weight: 700;
    padding: 0 3px;
    border-radius: 3px;
    border: 1px solid #e6c200;
  }
  a.dp-pick:hover { background: #ffe45e; }
  span.dp-disabled {
    background: #eaecf0;
    color: #72777d;
    text-decoration: line-through;
    padding: 0 3px;
    border-radius: 3px;
    border: 1px dashed #a2a9b1;
    cursor: not-allowed;
  }
  table.infobox { float: right; margin: 0 0 1em 1em; border: 1px solid #a2a9b1; font-size: 14px; }
  img { max-width: 100%; }
  .dp-error { font-family: sans-serif; padding: 40px; text-align: center; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
