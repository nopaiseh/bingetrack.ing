import type { Breadcrumb, Event } from "@sentry/nextjs";

/** 一次性登录凭证和常见 OAuth 查询参数，不能进入 Sentry。 */
const SENSITIVE_QUERY_KEYS = new Set(["token_hash", "token", "code"]);

function isSensitiveKey(key: string): boolean {
  let decoded = key;
  try {
    decoded = decodeURIComponent(key.replace(/\+/g, " "));
  } catch {
    decoded = key;
  }
  return SENSITIVE_QUERY_KEYS.has(decoded.toLowerCase());
}

/** 去掉查询串里的敏感参数，其余参数保持原样。 */
function stripQuery(query: string): string {
  const kept: string[] = [];
  let changed = false;
  for (const part of query.split("&")) {
    if (!part) {
      kept.push(part);
      continue;
    }
    const eq = part.indexOf("=");
    const rawKey = eq === -1 ? part : part.slice(0, eq);
    if (isSensitiveKey(rawKey)) {
      changed = true;
      continue;
    }
    kept.push(part);
  }
  return changed ? kept.join("&") : query;
}

function looksLikeBareQuery(value: string): boolean {
  return !value.includes("://") && !value.includes("/") && value.includes("=");
}

/**
 * 从 URL、带查询串的路径，或单独的查询串中去掉 token_hash、token 和 code。
 * 没有这些参数时原样返回。
 */
export function scrubSensitiveUrl(value: string): string {
  const question = value.indexOf("?");
  if (question === -1) {
    return looksLikeBareQuery(value) ? stripQuery(value) : value;
  }
  const hash = value.indexOf("#", question);
  const query = hash === -1 ? value.slice(question + 1) : value.slice(question + 1, hash);
  const stripped = stripQuery(query);
  if (stripped === query) return value;
  const suffix = hash === -1 ? "" : value.slice(hash);
  return `${value.slice(0, question)}${stripped ? `?${stripped}` : ""}${suffix}`;
}

function scrubQueryValue(value: NonNullable<Event["request"]>["query_string"]): NonNullable<Event["request"]>["query_string"] {
  if (typeof value === "string") return scrubSensitiveUrl(value);
  if (Array.isArray(value)) return value.filter(([key]) => !isSensitiveKey(key));
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      if (isSensitiveKey(key)) delete value[key];
    }
  }
  return value;
}

function scrubUnknown(value: unknown): unknown {
  if (typeof value === "string") return scrubSensitiveUrl(value);
  if (Array.isArray(value)) return value.map((item) => (typeof item === "string" ? scrubSensitiveUrl(item) : item));
  return value;
}

/** 面包屑里的导航和请求地址可能带上确认页的一次性凭证。 */
export function scrubSentryBreadcrumb<T extends Breadcrumb>(breadcrumb: T): T {
  if (typeof breadcrumb.message === "string") breadcrumb.message = scrubSensitiveUrl(breadcrumb.message);
  if (breadcrumb.data) {
    for (const key of Object.keys(breadcrumb.data)) {
      breadcrumb.data[key] = scrubUnknown(breadcrumb.data[key]);
    }
  }
  return breadcrumb;
}

function scrubSpan(span: NonNullable<Event["spans"]>[number]): void {
  if (typeof span.description === "string") span.description = scrubSensitiveUrl(span.description);
  const named = span as { name?: unknown };
  if (typeof named.name === "string") named.name = scrubSensitiveUrl(named.name);
  if (!span.data) return;
  for (const key of Object.keys(span.data)) {
    const value = span.data[key];
    if (typeof value === "string") {
      span.data[key] = scrubSensitiveUrl(value);
    } else if (Array.isArray(value) && value.every((item): item is string | null | undefined => item == null || typeof item === "string")) {
      span.data[key] = value.map((item) => (typeof item === "string" ? scrubSensitiveUrl(item) : item));
    }
  }
}

/** 错误事件和性能事务共用：请求 URL、事务名、面包屑和 span 里的凭证都去掉。 */
export function scrubSentryEvent<T extends Event>(event: T): T {
  if (event.request) {
    if (typeof event.request.url === "string") event.request.url = scrubSensitiveUrl(event.request.url);
    if (event.request.query_string !== undefined) event.request.query_string = scrubQueryValue(event.request.query_string);
    if (event.request.headers) {
      for (const key of Object.keys(event.request.headers)) {
        const value = event.request.headers[key];
        if (typeof value === "string") event.request.headers[key] = scrubSensitiveUrl(value);
      }
    }
  }
  if (typeof event.transaction === "string") event.transaction = scrubSensitiveUrl(event.transaction);
  if (event.breadcrumbs) {
    for (const breadcrumb of event.breadcrumbs) scrubSentryBreadcrumb(breadcrumb);
  }
  if (event.spans) {
    for (const span of event.spans) scrubSpan(span);
  }
  return event;
}
