/** Supabase SSR 会话 Cookie 名称：`sb-<project-ref>-auth-token`，超过约 3180 字符时拆成 `.0`、`.1`。 */
const SESSION_COOKIE_NAME = /^sb-.+-auth-token(?:\.\d+)?$/;

/** 判断是否为可读的会话 Cookie，排除 PKCE 的 code-verifier。 */
export function isSupabaseAuthSessionCookie(name: string) {
  return SESSION_COOKIE_NAME.test(name);
}

/** 在 `document.cookie` 形式的字符串里查找会话 Cookie。 */
export function hasSupabaseAuthCookie(cookieHeader: string) {
  if (!cookieHeader) return false;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf("=");
    const name = separator === -1 ? trimmed : trimmed.slice(0, separator);
    if (isSupabaseAuthSessionCookie(name)) return true;
  }
  return false;
}
