import assert from "node:assert/strict";
import test from "node:test";
import { checkRateLimit } from "../lib/api/rate-limit.ts";

test("limits repeated requests within the same bucket and window", () => {
  const request = new Request("https://example.test", {
    headers: { "x-forwarded-for": "203.0.113.42" },
  });
  const bucket = `test-${Date.now()}-${Math.random()}`;

  assert.equal(checkRateLimit(request, bucket, 1, 60_000).allowed, true);
  const blocked = checkRateLimit(request, bucket, 1, 60_000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfter > 0);
});
