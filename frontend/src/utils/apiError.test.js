import test from "node:test";
import assert from "node:assert/strict";
import { apiErrorMessage } from "./apiError.js";

const fail = (data) => ({ response: { data } });

test("shows the specific validation reasons, without repeats", () => {
  const err = fail({ message: "Validation failed", errors: [
    { field: "password", message: "Password must contain at least one number" },
    { field: "password", message: "Password must contain at least one number" },
    { field: "email", message: "Enter a valid email address" },
  ] });
  assert.equal(apiErrorMessage(err, "x"), "Password must contain at least one number. Enter a valid email address");
});

test("falls back to the server message, then to the given fallback", () => {
  assert.equal(apiErrorMessage(fail({ message: "Invalid email or password" }), "x"), "Invalid email or password");
  assert.equal(apiErrorMessage(fail({}), "Login failed"), "Login failed");
  assert.equal(apiErrorMessage(new Error("network"), "Login failed"), "Login failed");
  assert.equal(apiErrorMessage(undefined, "Oops"), "Oops");
});

test("an empty errors list uses the message", () => {
  assert.equal(apiErrorMessage(fail({ message: "Validation failed", errors: [] }), "x"), "Validation failed");
});
