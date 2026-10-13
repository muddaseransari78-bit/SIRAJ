// Phase 22 - static security check of the route files (no server needed).
// It reads the route files as text and makes sure nobody can reach private or admin
// endpoints without logging in, and that public files never contain write routes by accident.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROUTES = path.join(__dirname, "..", "routes");
const read = (name) => fs.readFileSync(path.join(ROUTES, name), "utf8").replace(/\/\/.*$/gm, "");
const VERB_LINE = /^\s*\w+(?:Router)?\.(get|post|put|patch|delete)\(/;

function lines(name) {
  return read(name).split("\n");
}
function firstRouteIndex(ls) {
  return ls.findIndex((l) => VERB_LINE.test(l));
}
function guardIndex(ls, re) {
  return ls.findIndex((l) => re.test(l));
}

// Every route in these files belongs to the logged-in user.
const PRIVATE_FILES = [
  "bookmarkRoutes.js", "noteRoutes.js", "progressRoutes.js", "goalRoutes.js",
  "notificationRoutes.js", "userRoutes.js", "dashboardRoutes.js", "tasbeehRoutes.js", "feedbackRoutes.js",
];

for (const file of PRIVATE_FILES) {
  test(`${file}: router.use(requireAuth) comes before the first route`, () => {
    const ls = lines(file);
    const guard = guardIndex(ls, /router\.use\(\s*requireAuth\s*\)/);
    const first = firstRouteIndex(ls);
    assert.ok(guard >= 0, "no router.use(requireAuth)");
    assert.ok(first === -1 || guard < first, "routes are declared before the auth guard");
  });
}

test("adminRoutes.js: requireAuth AND the ADMIN/SUPER_ADMIN role guard come before every route", () => {
  const ls = lines("adminRoutes.js");
  const guard = guardIndex(ls, /router\.use\(\s*requireAuth\s*,\s*roleGuard\(\s*\[\s*"ADMIN"\s*,\s*"SUPER_ADMIN"\s*\]\s*\)\s*\)/);
  const first = firstRouteIndex(ls);
  assert.ok(guard >= 0, "admin guard is missing");
  assert.ok(guard < first, "an admin route is declared before the guard");
});

test("adminRoutes.js: a plain USER role is never listed as allowed", () => {
  assert.ok(!/roleGuard\(\s*\[[^\]]*"USER"/.test(read("adminRoutes.js")));
});

test("prayerRoutes.js: only /times is public; settings, log and stats need a login", () => {
  const routeLines = lines("prayerRoutes.js").filter((l) => VERB_LINE.test(l));
  assert.ok(routeLines.length >= 5);
  for (const l of routeLines) {
    if (/"\/times"/.test(l)) continue;
    assert.match(l, /requireAuth/, `unprotected: ${l.trim()}`);
  }
});

test("recitationRoutes.js: only the harmless on/off status is public; checks and sessions need a login", () => {
  const routeLines = lines("recitationRoutes.js").filter((l) => VERB_LINE.test(l));
  assert.ok(routeLines.length >= 4);
  for (const l of routeLines) {
    if (/"\/harakat\/status"/.test(l)) continue; // returns only { enabled: true/false }
    assert.match(l, /requireAuth/, `unprotected: ${l.trim()}`);
  }
  // the paid/slow model route must be rate limited AND need a login
  const check = routeLines.find((l) => /"\/harakat"/.test(l));
  assert.match(check, /limiter/);
  assert.match(check, /requireAuth/);
});

test("ramadanRoutes.js: fasting log needs a login", () => {
  const routeLines = lines("ramadanRoutes.js").filter((l) => /\/fasting/.test(l));
  assert.ok(routeLines.length >= 2);
  for (const l of routeLines) assert.match(l, /requireAuth/);
});

test("public route files contain no write routes (POST/PUT/PATCH/DELETE) except the allowed ones", () => {
  const PUBLIC_FILES = ["quranRoutes.js", "hadithRoutes.js", "duaQiblaRoutes.js", "contentRoutes.js",
    "searchRoutes.js", "settingsRoutes.js"];
  const writes = [];
  for (const f of PUBLIC_FILES) {
    for (const l of lines(f)) {
      const m = l.match(/\.(post|put|patch|delete)\(/);
      if (m) writes.push(`${f}: ${l.trim()}`);
    }
  }
  assert.deepStrictEqual(writes, []);
});

test("assistant /ask is the only public write route and it has a rate limiter", () => {
  const l = lines("assistantRoutes.js").filter((x) => /\.post\(/.test(x));
  assert.strictEqual(l.length, 1);
  assert.match(l[0], /limiter/i);
});

test("login and register are rate limited and validated", () => {
  const ls = lines("authRoutes.js");
  const login = ls.find((l) => /"\/login"/.test(l));
  const register = ls.find((l) => /"\/register"/.test(l));
  for (const l of [login, register]) {
    assert.match(l, /authLimiter/);
    assert.match(l, /validate\(/);
  }
  assert.match(ls.find((l) => /"\/refresh"/.test(l)), /refreshLimiter/);
  assert.match(ls.find((l) => /"\/me"/.test(l)), /requireAuth/);
});

test("expensive public endpoints (search, place search, suggestions) are rate limited", () => {
  assert.match(read("searchRoutes.js"), /suggest.*suggestLimiter|suggestLimiter.*suggest/s);
  const sr = lines("searchRoutes.js").filter((l) => VERB_LINE.test(l));
  for (const l of sr) assert.match(l, /Limiter/);
  assert.match(lines("duaQiblaRoutes.js").find((l) => /"\/search"/.test(l)), /Limiter/);
});

test("routes/index.js mounts every route file, and /admin is mounted", () => {
  const index = fs.readFileSync(path.join(ROUTES, "index.js"), "utf8");
  const files = fs.readdirSync(ROUTES).filter((f) => f.endsWith(".js") && f !== "index.js");
  const missing = files.filter((f) => !index.includes(`./${f.replace(/\.js$/, "")}`));
  assert.deepStrictEqual(missing, []);
  assert.match(index, /router\.use\("\/admin",\s*adminRoutes\)/);
});

test("no route file contains a hard-coded secret or key", () => {
  for (const f of fs.readdirSync(ROUTES)) {
    const text = fs.readFileSync(path.join(ROUTES, f), "utf8");
    assert.ok(!/(secret|password|apikey|api_key)\s*[:=]\s*["'][^"']{6,}["']/i.test(text), `${f} looks like it has a secret`);
  }
});
