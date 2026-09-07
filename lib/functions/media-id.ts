/** 接受标准 UUID 路由 ID，不限制 UUID 版本；拒绝空值和错误格式。 */
export function isMediaId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
