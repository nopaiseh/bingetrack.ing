import assert from "node:assert/strict";
import { test } from "vitest";
import { quotePostgrestFilterValue } from "../lib/functions/postgrest-filter.ts";

test.each([
  ["%test,id.neq.0%", '"%test,id.neq.0%"'],
  ["%WALL·E%", '"%WALL·E%"'],
  ["%片名（导演剪辑版）%", '"%片名（导演剪辑版）%"'],
  ['%"quoted"%', '"%\\"quoted\\"%"'],
  ["%back\\slash%", '"%back\\\\slash%"'],
  ["%100%%", '"%100%%"'],
  ["%under_score%", '"%under_score%"'],
])("quotes a raw PostgREST filter value containing %s", (value, expected) => {
  assert.equal(quotePostgrestFilterValue(value), expected);
});
