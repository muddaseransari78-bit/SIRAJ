/**
 * SIRAJ deployment check (Phase 23) - run it AFTER you deployed. It only reads; it creates nothing.
 *
 *   $env:API_URL="https://YOUR-BACKEND.onrender.com"
 *   $env:SITE_URL="https://YOUR-SITE.vercel.app"
 *   npm run deploy-check
 *
 * Checks: API alive and ready (database), the standard 404 shape, no stack trace, CORS allows your site
 * and not a stranger, security headers on the API and on the site, the single-page rewrite (/quran/2),
 * manifest and service worker. Needs Node 18+.
 */
const API = (process.env.API_URL || "").replace(/\/$/, "");
const SITE = (process.env.SITE_URL || "").replace(/\/$/, "");
let pass = 0, fail = 0, warn = 0;

function line(kind, name, extra = "") {
  console.log(`${kind}  ${name}${extra ? "  -> " + extra : ""}`);
  if (kind === "PASS") pass++; else if (kind === "FAIL") fail++; else warn++;
}
const check = (name, ok, extra) => { line(ok ? "PASS" : "FAIL", name, ok ? "" : extra); return ok; };

async function get(url, headers = {}, method = "GET") {
  try {
    const res = await fetch(url, { method, headers, redirect: "manual" });
    const text = await res.text();
    return { status: res.status, headers: res.headers, text };
  } catch (err) {
    return { status: 0, headers: new Headers(), text: String(err.message) };
  }
}

async function main() {
  if (!API) {
    console.log("Set API_URL first, e.g.  $env:API_URL=\"https://YOUR-BACKEND.onrender.com\"");
    process.exit(1);
  }
  console.log(`API:  ${API}\nSITE: ${SITE || "(not set - site checks skipped)"}\n`);
  console.log("(A free Render service may need ~30 seconds to wake up; the first line can be slow.)\n");

  // ---- backend
  const health = await get(`${API}/api/health`);
  check("API /api/health answers 200", health.status === 200, `status ${health.status} ${health.text.slice(0, 80)}`);
  if (health.status === 0) { console.log("\nCannot reach the API at all. Check the URL and the Render logs."); return summary(); }

  const ready = await get(`${API}/api/health/ready`);
  check("API /api/health/ready: database connected (200)", ready.status === 200, `status ${ready.status} ${ready.text.slice(0, 120)}`);

  const nf = await get(`${API}/api/nope-${Date.now()}`);
  let nfJson = null; try { nfJson = JSON.parse(nf.text); } catch { /* ignore */ }
  check("unknown route gives the standard JSON 404", nf.status === 404 && nfJson && nfJson.success === false, `status ${nf.status}`);
  check("no stack trace is shown to visitors", !/\bat .*\.js:\d+/.test(nf.text) && !(nfJson && nfJson.error), nf.text.slice(0, 120));

  const h = health.headers;
  check("API sends X-Content-Type-Options: nosniff", (h.get("x-content-type-options") || "").includes("nosniff"));
  check("API hides the X-Powered-By header", !h.get("x-powered-by"), `value: ${h.get("x-powered-by")}`);
  if (/^https:/.test(API)) check("API sends Strict-Transport-Security (HTTPS)", !!h.get("strict-transport-security"));
  else line("WARN", "API is not on HTTPS", "fine for localhost, NOT fine for production");

  const surahs = await get(`${API}/api/quran/surahs`);
  if (surahs.status === 200) check("Quran surah list reachable", true);
  else line("WARN", "Quran surah list", `status ${surahs.status} (outside Quran API down?)`);

  // ---- CORS
  if (SITE) {
    const ok = await get(`${API}/api/health`, { Origin: SITE });
    check("CORS: your site is allowed (CLIENT_URL is right)", ok.headers.get("access-control-allow-origin") === SITE, `got "${ok.headers.get("access-control-allow-origin")}" - CLIENT_URL must be exactly ${SITE}`);
    check("CORS: cookies are allowed for your site", ok.headers.get("access-control-allow-credentials") === "true");
    const bad = await get(`${API}/api/health`, { Origin: "https://evil.example.com" });
    check("CORS: a stranger's site is NOT allowed", bad.headers.get("access-control-allow-origin") !== "https://evil.example.com", "CLIENT_URL is too open");
  } else line("WARN", "CORS checks skipped", "set SITE_URL to run them");

  // ---- frontend
  if (SITE) {
    const home = await get(`${SITE}/`);
    check("site home answers 200", home.status === 200, `status ${home.status}`);
    const sh = home.headers;
    check("site sends Content-Security-Policy", !!sh.get("content-security-policy"), "headers file not applied (vercel.json / _headers / nginx)");
    check("site CSP keeps script-src 'self' only", /script-src 'self'(;|$)/.test(sh.get("content-security-policy") || ""));
    check("site sends X-Frame-Options / frame-ancestors", !!sh.get("x-frame-options") || /frame-ancestors/.test(sh.get("content-security-policy") || ""));
    check("site sends Strict-Transport-Security", /^https:/.test(SITE) ? !!sh.get("strict-transport-security") : true);

    const deep = await get(`${SITE}/quran/2`);
    check("refreshing /quran/2 works (single-page rewrite)", deep.status === 200 && /<div id="root"/.test(deep.text), `status ${deep.status}`);

    const manifest = await get(`${SITE}/manifest.webmanifest`);
    check("PWA manifest is served", manifest.status === 200 && /"name"/.test(manifest.text), `status ${manifest.status}`);
    const sw = await get(`${SITE}/sw.js`);
    check("service worker is served and not cached hard", sw.status === 200 && /no-cache|max-age=0/.test(sw.headers.get("cache-control") || ""), `status ${sw.status}, cache-control ${sw.headers.get("cache-control")}`);
  }
  summary();
}

function summary() {
  console.log(`\n${pass} passed, ${fail} failed, ${warn} warnings`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("deploy-check crashed:", e); process.exit(1); });
