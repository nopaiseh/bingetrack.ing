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

/** 记录已被降级处理、不再向上抛出的错误并上报 Sentry；向上抛出的请求错误由 onRequestError 统一上报。 */
export function reportHandledError(message: string, error: unknown): void {
  console.error(message, error);
  Sentry.captureException(error, { extra: { message } });
}
