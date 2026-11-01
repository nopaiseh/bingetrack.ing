import { expect, test } from "vitest";
import { hasSupabaseAuthCookie, isSupabaseAuthSessionCookie } from "@/lib/auth/session-cookie";

test("recognizes the supabase session cookie and its chunks", () => {
  expect(isSupabaseAuthSessionCookie("sb-example-auth-token")).toBe(true);
  expect(isSupabaseAuthSessionCookie("sb-127-auth-token.0")).toBe(true);
  expect(isSupabaseAuthSessionCookie("sb-example-auth-token.12")).toBe(true);
});

test("ignores PKCE verifiers and unrelated cookies", () => {
  expect(isSupabaseAuthSessionCookie("sb-example-auth-token-code-verifier")).toBe(false);
  expect(isSupabaseAuthSessionCookie("sb-example-auth-token-flows-code-verifier")).toBe(false);
  expect(isSupabaseAuthSessionCookie("sb-example-auth-token-flow-abc-code-verifier")).toBe(false);
  expect(isSupabaseAuthSessionCookie("sb-example-auth-token.0.1")).toBe(false);
  expect(isSupabaseAuthSessionCookie("theme")).toBe(false);
  expect(isSupabaseAuthSessionCookie("")).toBe(false);
});

test("finds a session cookie inside a document.cookie string", () => {
  expect(hasSupabaseAuthCookie("")).toBe(false);
  expect(hasSupabaseAuthCookie("theme=dark")).toBe(false);
  expect(hasSupabaseAuthCookie("sb-example-auth-token-code-verifier=abc")).toBe(false);
  expect(hasSupabaseAuthCookie("theme=dark; sb-example-auth-token.0=abc")).toBe(true);
  expect(hasSupabaseAuthCookie("sb-example-auth-token=abc; theme=dark")).toBe(true);
});
