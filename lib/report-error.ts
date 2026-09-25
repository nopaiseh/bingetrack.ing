import * as Sentry from "@sentry/nextjs";

/** 记录已被降级处理、不再向上抛出的错误并上报 Sentry；向上抛出的请求错误由 onRequestError 统一上报。 */
export function reportHandledError(message: string, error: unknown): void {
  console.error(message, error);
  Sentry.captureException(error, { extra: { message } });
}
