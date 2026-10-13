import test from "node:test";
import assert from "node:assert";
import { formatUptime, toCsv, actionLabel, healthClass, shortDay } from "./adminFormat.js";

test("formatUptime", () => {
  assert.strictEqual(formatUptime(0), "0 min");
  assert.strictEqual(formatUptime(125), "2 min");
  assert.strictEqual(formatUptime(7500), "2 h 5 min");
  assert.strictEqual(formatUptime(200000), "2 d 7 h");
  assert.strictEqual(formatUptime(-5), "0 min");
  assert.strictEqual(formatUptime("abc"), "0 min");
});

test("toCsv writes a header and numbers as they are", () => {
  const csv = toCsv([{ date: "2026-10-01", n: 3 }, { date: "2026-10-02", n: 0 }], [{ key: "date", label: "Date" }, { key: "n", label: "Count" }]);
  assert.strictEqual(csv, "Date,Count\n2026-10-01,3\n2026-10-02,0");
});

test("toCsv quotes commas, quotes and new lines", () => {
  const csv = toCsv([{ a: 'say "hi", ok', b: "line1\nline2" }], [{ key: "a", label: "A" }, { key: "b", label: "B" }]);
  assert.strictEqual(csv, 'A,B\n"say ""hi"", ok","line1\nline2"');
});

test("toCsv blocks spreadsheet formulas and tolerates missing values", () => {
  const csv = toCsv([{ a: "=SUM(A1:A9)", b: "+1", c: "@cmd", d: undefined, e: null, f: -4 }],
    ["a", "b", "c", "d", "e", "f"].map((k) => ({ key: k, label: k })));
  assert.strictEqual(csv, "a,b,c,d,e,f\n'=SUM(A1:A9),'+1,'@cmd,,,-4");
});

test("actionLabel falls back to the raw action", () => {
  assert.strictEqual(actionLabel("ROLE_CHANGE"), "Role changed");
  assert.strictEqual(actionLabel("SOMETHING_NEW"), "SOMETHING_NEW");
});

test("healthClass and shortDay", () => {
  assert.strictEqual(healthClass("ok"), "text-noor-emeraldBright");
  assert.strictEqual(healthClass("check"), "text-noor-goldBright");
  assert.strictEqual(healthClass("problem"), "text-red-400");
  assert.strictEqual(healthClass(undefined), "text-red-400");
  assert.strictEqual(shortDay("2026-10-03"), "03 Oct");
});
