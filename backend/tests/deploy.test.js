// Phase 23 - deployment files: graceful shutdown, secret generator, Render blueprint, Docker and compose files.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const { createShutdown } = require("../utils/shutdown");
const { makeSecretPair } = require("../scripts/generate-secrets");
const { checkEnv } = require("../utils/envCheck");

const ROOT = path.join(__dirname, "..", "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// ---------- graceful shutdown ----------
function fakeServer() {
  return { closed: false, close(cb) { this.closed = true; this.cb = cb; } };
}
function fakeMongoose(fail = false) {
  return { closedWith: null, connection: { async close(force) { this.closedWith = force; if (fail) throw new Error("boom"); } } };
}

test("shutdown: stops the server, closes MongoDB, exits with 0", async () => {
  const server = fakeServer();
  const mongoose = fakeMongoose();
  const exits = [];
  const logs = [];
  const shutdown = createShutdown({ server, mongoose, exit: (c) => exits.push(c), log: (m) => logs.push(m), setTimer: () => ({ unref() {} }) });
  shutdown("SIGTERM");
  assert.strictEqual(server.closed, true);
  assert.deepStrictEqual(exits, []); // not yet: waiting for running requests
  await server.cb();
  assert.strictEqual(mongoose.connection.closedWith, false);
  assert.deepStrictEqual(exits, [0]);
  assert.ok(logs.some((l) => /SIGTERM/.test(l)));
});

test("shutdown: a second signal does nothing", () => {
  const server = fakeServer();
  let closes = 0;
  server.close = () => { closes++; };
  const shutdown = createShutdown({ server, mongoose: fakeMongoose(), exit: () => {}, log: () => {}, setTimer: () => ({ unref() {} }) });
  shutdown("SIGTERM");
  shutdown("SIGINT");
  assert.strictEqual(closes, 1);
});

test("shutdown: a MongoDB close error is logged and we still exit 0", async () => {
  const server = fakeServer();
  const exits = [];
  const logs = [];
  const shutdown = createShutdown({ server, mongoose: fakeMongoose(true), exit: (c) => exits.push(c), log: (m) => logs.push(m), setTimer: () => ({ unref() {} }) });
  shutdown("SIGINT");
  await server.cb();
  assert.deepStrictEqual(exits, [0]);
  assert.ok(logs.some((l) => /MongoDB close error: boom/.test(l)));
});

test("shutdown: a hanging server is forced to exit 1 by the timer", () => {
  const server = fakeServer();
  const exits = [];
  let fire;
  const shutdown = createShutdown({ server, mongoose: fakeMongoose(), exit: (c) => exits.push(c), log: () => {}, timeoutMs: 5000, setTimer: (fn, ms) => { fire = fn; assert.strictEqual(ms, 5000); return { unref() {} }; } });
  shutdown("SIGTERM");
  fire();
  assert.deepStrictEqual(exits, [1]);
});

test("server.js wires SIGTERM, SIGINT and the crash handlers", () => {
  const src = read("backend/server.js");
  for (const needle of ["SIGTERM", "SIGINT", "unhandledRejection", "uncaughtException", "createShutdown"]) assert.ok(src.includes(needle), needle);
});

// ---------- secret generator ----------
test("generate-secrets: two different long secrets that pass the production env check", () => {
  const pair = makeSecretPair();
  assert.notStrictEqual(pair.JWT_ACCESS_SECRET, pair.JWT_REFRESH_SECRET);
  assert.ok(pair.JWT_ACCESS_SECRET.length >= 64 && /^[0-9a-f]+$/.test(pair.JWT_ACCESS_SECRET));
  const { errors } = checkEnv({ NODE_ENV: "production", MONGO_URI: "mongodb://x", CLIENT_URL: "https://a.example", TRUST_PROXY: "1", ...pair });
  assert.deepStrictEqual(errors, []);
});

test("generate-secrets: every run gives new values", () => {
  assert.notStrictEqual(makeSecretPair().JWT_ACCESS_SECRET, makeSecretPair().JWT_ACCESS_SECRET);
});

// ---------- readiness route ----------
test("routes/index.js has /health and /health/ready (503 while the database is down)", () => {
  const src = read("backend/routes/index.js");
  assert.match(src, /router\.get\("\/health"/);
  assert.match(src, /router\.get\("\/health\/ready"/);
  assert.match(src, /readyState === 1/);
  assert.match(src, /ready \? 200 : 503/);
});

// ---------- Render blueprint ----------
function renderKeys() {
  const yaml = read("render.yaml");
  return [...yaml.matchAll(/- key: ([A-Z_]+)/g)].map((m) => m[1]);
}
test("render.yaml: sets every variable production needs, secrets are generated not typed", () => {
  const keys = renderKeys();
  for (const k of ["NODE_ENV", "MONGO_URI", "CLIENT_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "COOKIE_SAMESITE", "TRUST_PROXY"]) assert.ok(keys.includes(k), `${k} missing`);
  const yaml = read("render.yaml");
  assert.match(yaml, /key: JWT_ACCESS_SECRET\s+generateValue: true/);
  assert.match(yaml, /key: JWT_REFRESH_SECRET\s+generateValue: true/);
  assert.match(yaml, /key: MONGO_URI\s+sync: false/);
  assert.match(yaml, /healthCheckPath: \/api\/health\/ready/);
  assert.match(yaml, /rootDir: backend/);
});

test("render.yaml: every variable it sets is documented in .env.example", () => {
  const example = read("backend/.env.example");
  const listed = new Set([...example.matchAll(/^\s*#?\s*([A-Z][A-Z0-9_]+)\s*=/gm)].map((m) => m[1]));
  const skip = new Set(["NODE_VERSION"]);
  assert.deepStrictEqual(renderKeys().filter((k) => !listed.has(k) && !skip.has(k)), []);
});

test("render.yaml: contains no real-looking secret or database string", () => {
  assert.ok(!/mongodb(\+srv)?:\/\/[^\s]+@/.test(read("render.yaml")));
});

// ---------- Docker ----------
test("backend Dockerfile: production, no dev packages, not root, health check on /ready", () => {
  const d = read("backend/Dockerfile");
  assert.match(d, /NODE_ENV=production/);
  assert.match(d, /npm install --omit=dev/);
  assert.match(d, /^USER node$/m);
  assert.match(d, /HEALTHCHECK/);
  assert.match(d, /health\/ready/);
  assert.match(d, /CMD \["node", "server\.js"\]/);
});

test("Docker ignore files keep .env and node_modules out of the images", () => {
  for (const f of ["backend/.dockerignore", "frontend/.dockerignore"]) {
    const t = read(f);
    assert.match(t, /^node_modules$/m);
    assert.match(t, /^\.env$/m);
  }
});

test("docker-compose: MongoDB is not published, secrets are required, backend is production", () => {
  const c = read("docker-compose.yml");
  const mongoBlock = c.split(/\n  backend:/)[0];
  assert.ok(!/ports:/.test(mongoBlock), "mongo must not publish a port");
  assert.match(c, /JWT_ACCESS_SECRET: \$\{JWT_ACCESS_SECRET:\?/);
  assert.match(c, /JWT_REFRESH_SECRET: \$\{JWT_REFRESH_SECRET:\?/);
  assert.match(c, /NODE_ENV: production/);
  assert.match(c, /MONGO_URI: mongodb:\/\/mongo:27017\/siraj/);
  assert.ok(!/JWT_[A-Z_]+SECRET: [A-Za-z0-9]{20,}/.test(c), "no secret may be typed into compose");
});

test(".env.docker is ignored by Git and has an example file", () => {
  const gi = read(".gitignore");
  assert.match(gi, /\.env\.docker$/m);
  assert.ok(fs.existsSync(path.join(ROOT, ".env.docker.example")));
  assert.ok(!/JWT_[A-Z_]+SECRET=\S/.test(read(".env.docker.example")), "example must have empty secrets");
});

test("CI workflow runs backend tests, frontend tests and the build (and does not need a package-lock.json cache)", () => {
  const y = read(".github/workflows/ci.yml");
  assert.match(y, /npm test/);
  assert.match(y, /npm run build/);
  assert.doesNotMatch(y, /cache-dependency-path/, "no package-lock.json is shipped: a lock-file cache makes the CI fail");
});

test("package.json has the new scripts and a Node version", () => {
  const pkg = JSON.parse(read("backend/package.json"));
  assert.strictEqual(pkg.scripts.secrets, "node scripts/generate-secrets.js");
  assert.strictEqual(pkg.scripts["deploy-check"], "node scripts/deploy-check.js");
  assert.ok(pkg.engines && /18/.test(pkg.engines.node));
});
