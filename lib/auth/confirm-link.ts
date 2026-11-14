import "server-only";

/** 后台一次性链接只接受这两种类型；其余类型一律视为无效，不调用验证。 */
const CONFIRM_TYPES = ["magiclink", "invite"] as const;

export type ConfirmType = (typeof CONFIRM_TYPES)[number];

function isConfirmType(value: string): value is ConfirmType {
  return (CONFIRM_TYPES as readonly string[]).includes(value);
}

export type ConfirmNext = "/settings" | "/manage";

export type ConfirmQuery =
  | { ok: true; tokenHash: string; type: ConfirmType; next: ConfirmNext }
  | { ok: false };

type QueryValue = string | string[] | null | undefined;

/** 与 URLSearchParams.get 一样只取第一个值，并忽略空白。 */
function firstValue(value: QueryValue): string | null {
  const picked = Array.isArray(value) ? value[0] : value;
  if (typeof picked !== "string") return null;
  const trimmed = picked.trim();
  return trimmed ? trimmed : null;
}

/**
 * 回跳只允许精确的 /manage。其他值（包括外部地址、协议相对路径和 /settings 以外的站内路径）
 * 都落到 /settings，避免把一次性登录做成开放重定向。
 */
export function safeConfirmNext(next: string | null): ConfirmNext {
  return next === "/manage" ? "/manage" : "/settings";
}

/** 从查询串或表单字段读取一次性凭证。类型或 token 不合法时不返回可验证的数据。 */
export function readConfirmQuery(input: {
  token_hash?: QueryValue;
  type?: QueryValue;
  next?: QueryValue;
}): ConfirmQuery {
  const tokenHash = firstValue(input.token_hash);
  const type = firstValue(input.type);
  if (!tokenHash || !type || !isConfirmType(type)) return { ok: false };
  return { ok: true, tokenHash, type, next: safeConfirmNext(firstValue(input.next)) };
}

type OriginRequest = {
  headers: { get(name: string): string | null };
  nextUrl: { origin: string; protocol: string };
};

function header(request: OriginRequest, name: string): string | null {
  return request.headers.get(name);
}

/** 协议只接受 http/https，并去掉 URL.protocol 自带的冒号。 */
function httpProtocol(value: string | null | undefined): "http" | "https" | null {
  const protocol = value?.replace(/:$/, "");
  return protocol === "http" || protocol === "https" ? protocol : null;
}

/**
 * 浏览器提交表单时会带上 Origin。只接受与本次请求、Host 或站点规范地址一致的来源，
 * 挡住聊天预览之外的跨站代提交。反向代理的内部 origin 与浏览器看到的公网 origin 不一致时，
 * 仍允许 Host / NEXT_PUBLIC_SITE_URL 对应的来源，避免合法的确认提交被误拒。
 */
export function isSameOrigin(request: OriginRequest): boolean {
  const origin = header(request, "origin");
  if (!origin || origin === "null") return false;
  let actual: URL;
  try {
    actual = new URL(origin);
  } catch {
    return false;
  }
  if (actual.origin === "null") return false;

  const allowed = new Set<string>([request.nextUrl.origin]);
  const host = header(request, "host")?.split(",")[0]?.trim();
  for (const protocol of [httpProtocol(request.nextUrl.protocol), httpProtocol(header(request, "x-forwarded-proto")?.split(",")[0])]) {
    if (host && protocol) allowed.add(`${protocol}://${host}`);
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) {
    try {
      allowed.add(new URL(site).origin);
    } catch {
      // 配置不是绝对地址时不放宽来源。
    }
  }
  return allowed.has(actual.origin);
}
