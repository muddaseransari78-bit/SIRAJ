/**
 * SIRAJ smoke test (Phase 22) - talks to a RUNNING backend over HTTP.
 *
 * 1) Start MongoDB and the backend:   npm run dev
 * 2) In a second PowerShell window:   npm run smoke
 *    (other address: $env:SMOKE_URL="https://your-api.example.com"; npm run smoke)
 *
 * It creates two throw-away users (smoke-xxxx@example.com), checks the important rules
 * (login, privacy between users, admin blocked, bad input), and prints PASS / FAIL / WARN.
 * WARN = an outside service (Quran / Hadith API) did not answer - not a SIRAJ bug.
 * Needs Node 18+ (built-in fetch).
 */
const BASE = (process.env.SMOKE_URL || "http://localhost:5000").replace(/\/$/, "");
const PASSWORD = "Noor2026Smoke!";
const stamp = Date.now().toString(36);
let pass = 0, fail = 0, warn = 0;

function report(kind, name, extra = "") {
  const tag = { PASS: "PASS", FAIL: "FAIL", WARN: "WARN" }[kind];
  console.log(`${tag}  ${name}${extra ? "  -> " + extra : ""}`);
  if (kind === "PASS") pass++; else if (kind === "FAIL") fail++; else warn++;
}
async function call(method, path, { token, body, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  try {
    const res = await fetch(BASE + "/api" + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, json, text, headers: res.headers, raw };
  } catch (err) {
    return { status: 0, json: null, text: String(err.message), headers: new Headers() };
  }
}
function check(name, condition, extra) {
  report(condition ? "PASS" : "FAIL", name, condition ? "" : extra);
  return condition;
}

async function main() {
  console.log(`SIRAJ smoke test against ${BASE}\n`);

  // ---- server up
  const health = await call("GET", "/health");
  if (!check("health endpoint answers 200", health.status === 200, `status ${health.status} ${health.text.slice(0, 80)}`)) {
    console.log("\nThe backend is not reachable. Start it with `npm run dev` in the backend folder, then try again.");
    process.exit(1);
  }

  // ---- public content (needs the outside APIs, so only WARN when they are down)
  const surahs = await call("GET", "/quran/surahs");
  if (surahs.status === 200) check("Quran: 114 Surahs listed", surahs.json?.data?.surahs?.length === 114, `got ${surahs.json?.data?.surahs?.length}`);
  else report("WARN", "Quran surah list", `status ${surahs.status} (outside Quran API down or no internet?)`);

  const cc = surahs.headers.get("cache-control") || "";
  if (surahs.status === 200) check("Quran list is cacheable for guests", /public/.test(cc), `Cache-Control: ${cc}`);

  const unknownRoute = await call("GET", "/definitely-not-a-route");
  check("unknown route -> 404 JSON in the standard shape", unknownRoute.status === 404 && unknownRoute.json?.success === false, `status ${unknownRoute.status}`);

  // ---- register / login rules
  const emailA = `smoke-a-${stamp}@example.com`;
  const emailB = `smoke-b-${stamp}@example.com`;

  const weak = await call("POST", "/auth/register", { body: { name: "Smoke Weak", email: `smoke-w-${stamp}@example.com`, password: "abcdefgh" } });
  check("register: weak password refused (400)", weak.status === 400, `status ${weak.status}`);

  const regA = await call("POST", "/auth/register", { body: { name: "Smoke A", email: emailA, password: PASSWORD } });
  if (!check("register: new user created (201)", regA.status === 201 && !!regA.json?.data?.accessToken, `status ${regA.status} ${regA.text.slice(0, 120)}`)) {
    console.log("\nCannot continue without a user (is MongoDB running? is registration switched off in Admin -> Settings?).");
    return summary();
  }
  const tokenA = regA.json.data.accessToken;
  check("register: password hash is never sent back", !/passwordHash|\$2[aby]\$/.test(regA.text));
  check("register: a new user is role USER", regA.json.data.user?.role === "USER", `role ${regA.json.data.user?.role}`);

  const dup = await call("POST", "/auth/register", { body: { name: "Smoke A", email: emailA, password: PASSWORD } });
  check("register: same email twice -> 409", dup.status === 409, `status ${dup.status}`);

  const roleTry = await call("POST", "/auth/register", { body: { name: "Smoke Evil", email: `smoke-e-${stamp}@example.com`, password: PASSWORD, role: "SUPER_ADMIN" } });
  check("register: cannot make yourself SUPER_ADMIN", roleTry.status === 201 && roleTry.json?.data?.user?.role === "USER", `status ${roleTry.status} role ${roleTry.json?.data?.user?.role}`);

  const badPw = await call("POST", "/auth/login", { body: { email: emailA, password: "wrong-password-1" } });
  const noUser = await call("POST", "/auth/login", { body: { email: `nobody-${stamp}@example.com`, password: "wrong-password-1" } });
  check("login: wrong password -> 401", badPw.status === 401, `status ${badPw.status}`);
  check("login: wrong email and wrong password give the same message", badPw.json?.message === noUser.json?.message, `"${badPw.json?.message}" vs "${noUser.json?.message}"`);

  const inject = await call("POST", "/auth/login", { body: { email: { $gt: "" }, password: "x" } });
  check("login: NoSQL injection is refused (400)", inject.status === 400, `status ${inject.status}`);

  const loginA = await call("POST", "/auth/login", { body: { email: emailA, password: PASSWORD } });
  check("login: correct password works", loginA.status === 200 && !!loginA.json?.data?.accessToken, `status ${loginA.status}`);

  // ---- tokens
  const meNo = await call("GET", "/auth/me");
  check("/auth/me without token -> 401", meNo.status === 401, `status ${meNo.status}`);
  const meBad = await call("GET", "/auth/me", { token: tokenA.slice(0, -3) + "abc" });
  check("/auth/me with a damaged token -> 401", meBad.status === 401, `status ${meBad.status}`);
  const me = await call("GET", "/auth/me", { token: tokenA });
  check("/auth/me with a good token -> 200 and the right email", me.status === 200 && me.json?.data?.user?.email === emailA, `status ${me.status}`);

  // ---- admin is closed to normal users
  const adminNo = await call("GET", "/admin/stats");
  const adminUser = await call("GET", "/admin/stats", { token: tokenA });
  const adminUsers = await call("GET", "/admin/users", { token: tokenA });
  check("admin stats: no token -> 401", adminNo.status === 401, `status ${adminNo.status}`);
  check("admin stats: normal user -> 403", adminUser.status === 403, `status ${adminUser.status}`);
  check("admin users list: normal user -> 403", adminUsers.status === 403, `status ${adminUsers.status}`);

  // ---- private data needs login
  for (const path of ["/bookmarks", "/notes", "/progress", "/tasbeeh", "/dashboard/summary", "/notifications", "/goals", "/prayer/settings"]) {
    const r = await call("GET", path);
    check(`${path} without login -> 401`, r.status === 401, `status ${r.status}`);
  }

  // ---- notes: validation and privacy between two users
  const noteBad1 = await call("POST", "/notes", { token: tokenA, body: { surahNumber: "abc", ayahNumber: 1, text: "x" } });
  const noteBad2 = await call("POST", "/notes", { token: tokenA, body: { surahNumber: 1, ayahNumber: 1, text: "" } });
  const noteBad3 = await call("POST", "/notes", { token: tokenA, body: { surahNumber: 999, ayahNumber: 1, text: "x" } });
  const noteBad4 = await call("POST", "/notes", { token: tokenA, body: { surahNumber: 1, ayahNumber: 1, text: "x".repeat(2001) } });
  check("note: text surah number -> 400 (not 500)", noteBad1.status === 400, `status ${noteBad1.status}`);
  check("note: empty text -> 400", noteBad2.status === 400, `status ${noteBad2.status}`);
  check("note: Surah 999 -> 400", noteBad3.status === 400, `status ${noteBad3.status}`);
  check("note: 2001 characters -> 400", noteBad4.status === 400, `status ${noteBad4.status}`);

  const noteOk = await call("POST", "/notes", { token: tokenA, body: { surahNumber: 1, ayahNumber: 2, text: "Smoke test note" } });
  check("note: good note saved (201)", noteOk.status === 201 && !!noteOk.json?.data?.note?._id, `status ${noteOk.status}`);
  const noteId = noteOk.json?.data?.note?._id;

  const regB = await call("POST", "/auth/register", { body: { name: "Smoke B", email: emailB, password: PASSWORD } });
  const tokenB = regB.json?.data?.accessToken;
  if (check("second user created", !!tokenB, `status ${regB.status}`) && noteId) {
    const listB = await call("GET", "/notes", { token: tokenB });
    check("privacy: user B does not see user A's notes", listB.status === 200 && !listB.text.includes(noteId), `status ${listB.status}`);
    const delB = await call("DELETE", `/notes/${noteId}`, { token: tokenB });
    check("privacy: user B cannot delete user A's note (404)", delB.status === 404, `status ${delB.status}`);
    const stillThere = await call("GET", "/notes", { token: tokenA });
    check("privacy: the note is still there for user A", stillThere.text.includes(noteId));
    const delA = await call("DELETE", `/notes/${noteId}`, { token: tokenA });
    check("note: owner can delete it", delA.status === 200, `status ${delA.status}`);
  }

  // ---- bookmarks and progress
  const bm = await call("POST", "/bookmarks", { token: tokenA, body: { type: "AYAH", surahNumber: 2, ayahNumber: 255 } });
  check("bookmark: Ayat al-Kursi saved", bm.status === 200 || bm.status === 201, `status ${bm.status} ${bm.text.slice(0, 100)}`);
  const bmBad = await call("POST", "/bookmarks", { token: tokenA, body: { type: "AYAH", surahNumber: 500, ayahNumber: 1 } });
  check("bookmark: Surah 500 -> 400", bmBad.status === 400, `status ${bmBad.status}`);
  const bmList = await call("GET", "/bookmarks", { token: tokenA });
  check("bookmark: appears in the list", bmList.status === 200 && /255/.test(bmList.text), `status ${bmList.status}`);

  const prog = await call("PUT", "/progress", { token: tokenA, body: { surahNumber: 2, ayahNumber: 42 } });
  check("progress: position saved", prog.status === 200, `status ${prog.status} ${prog.text.slice(0, 100)}`);
  const progGet = await call("GET", "/progress", { token: tokenA });
  check("progress: position can be read back", progGet.status === 200 && /42/.test(progGet.text), `status ${progGet.status}`);

  // ---- logout
  const out = await call("POST", "/auth/logout");
  check("logout answers 200", out.status === 200, `status ${out.status}`);

  summary();
}

function summary() {
  console.log(`\n${pass} passed, ${fail} failed, ${warn} warnings`);
  console.log(`(test users smoke-*-${stamp}@example.com stay in your database - delete them in Admin -> Users if you like)`);
  process.exit(fail ? 1 : 0);
}

main().catch((err) => { console.error("Smoke test crashed:", err); process.exit(1); });
