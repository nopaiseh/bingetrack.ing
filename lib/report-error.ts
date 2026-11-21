import * as Sentry from "@sentry/nextjs";

/**
 * 用户可预期的输入／确认类错误码（如确认标题不符、字段校验）。
 * 管理端写入动作降级返回界面时不要上报 Sentry；其余数据库与未知错误仍须上报。
 */
export function isExpectedValidationCode(code?: string | null): boolean {
  return code === "22023";
}

/** 用户输入导致的可预期 Postgres 冲突：唯一约束、外键约束。不上报 Sentry，界面错误文案不变。 */
const EXPECTED_DB_ERROR_CODES = ["23505", "23503"] as const;

export function isExpectedDbError(code?: string | null): boolean {
  return code != null && (EXPECTED_DB_ERROR_CODES as readonly string[]).includes(code);
}

/** PostgREST／Postgres 错误上常见的可诊断字段（不含请求体或用户数据）。 */
export type DbErrorFields = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** 判断是否像 PostgREST／Postgres 错误对象（有 code／details／hint 之一）。 */
function hasDbErrorShape(value: unknown): value is DbErrorFields {
  if (!isRecord(value)) return false;
  return typeof value.code === "string" || typeof value.details === "string" || typeof value.hint === "string";
}

/** 从对象上只拷贝 code／message／details／hint，避免把其它属性（如请求上下文）带进 Sentry。 */
export function pickDbErrorFields(value: unknown): DbErrorFields | null {
  if (!hasDbErrorShape(value)) return null;
  return {
    code: typeof value.code === "string" ? value.code : undefined,
    message: typeof value.message === "string" ? value.message : undefined,
    details: typeof value.details === "string" ? value.details : value.details === null ? null : undefined,
    hint: typeof value.hint === "string" ? value.hint : value.hint === null ? null : undefined,
  };
}

/**
 * 将纯 PostgREST 错误对象收成 Error，并挂上 code／message／details／hint，
 * 以便 `Error.cause` 链能被 Sentry 展示；已是 Error 或非数据库形状时原样返回。
 */
export function normalizeDbErrorCause(cause: unknown): unknown {
  if (cause == null || cause instanceof Error) return cause;
  const fields = pickDbErrorFields(cause);
  if (!fields) return cause;
  const err = new Error(fields.message ?? fields.code ?? "Database error");
  err.name = fields.code ?? "PostgrestError";
  return Object.assign(err, fields);
}

/** 沿 cause／error 链查找第一组数据库错误字段（最多 6 层）。 */
export function findDbErrorFields(error: unknown): DbErrorFields | null {
  let current: unknown = error;
  for (let depth = 0; current != null && depth < 6; depth++) {
    const fields = pickDbErrorFields(current);
    if (fields) return fields;
    if (!isRecord(current)) break;
    if ("cause" in current) {
      current = current.cause;
      continue;
    }
    if ("error" in current) {
      current = current.error;
      continue;
    }
    break;
  }
  return null;
}

/** 从 MediaRepositoryError 等包装错误上读取失败的查询／操作名。 */
function findFailedQuery(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; current != null && depth < 6; depth++) {
    if (isRecord(current) && typeof current.operation === "string" && current.operation.length > 0) {
      return current.operation;
    }
    if (!isRecord(current) || !("cause" in current)) break;
    current = current.cause;
  }
  return undefined;
}

/** 记录已被降级处理、不再向上抛出的错误并上报 Sentry；向上抛出的请求错误由 onRequestError 统一上报。 */
export function reportHandledError(message: string, error: unknown): void {
  console.error(message, error);
  const db = findDbErrorFields(error);
  const query = findFailedQuery(error);
  const tags: Record<string, string> = {};
  if (db?.code) tags["db.code"] = db.code;
  if (query) tags["db.query"] = query;

  Sentry.captureException(error, {
    extra: {
      message,
      ...(db ? { db } : {}),
      ...(query ? { query } : {}),
    },
    tags: Object.keys(tags).length > 0 ? tags : undefined,
    contexts: db
      ? {
          postgrest: {
            code: db.code ?? null,
            message: db.message ?? null,
            details: db.details ?? null,
            hint: db.hint ?? null,
            query: query ?? null,
          },
        }
      : undefined,
  });
}
