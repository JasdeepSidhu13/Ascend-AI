import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashPassword, normalizeEmail, validEmail, validPassword, verifyPassword } from "./crypto-pass";

describe("passwords", () => {
  it("hashes and verifies", async () => {
    const stored = await hashPassword("correct horse");
    assert.equal(await verifyPassword("correct horse", stored), true);
    assert.equal(await verifyPassword("wrong", stored), false);
  });
  it("normalises email", () => {
    assert.equal(normalizeEmail("  Ada@Example.COM "), "ada@example.com");
    assert.equal(validEmail("ada@example.com"), true);
    assert.equal(validEmail("nope"), false);
    assert.equal(validPassword("short"), false);
    assert.equal(validPassword("long-enough"), true);
  });
});
