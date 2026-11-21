const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** 报告行 id：people:<uuid> 或 credit:<media>:<person>:<utf8-hex(角色名)>。 */
const NAME_ISSUE_ITEM_ID = new RegExp(`^(people:${UUID}|credit:${UUID}:${UUID}:[0-9a-f]+)$`, "i");

/** 校验确认键格式（应用提交前）。 */
export function isNameIssueItemId(value: string) {
  return NAME_ISSUE_ITEM_ID.test(value);
}

/** 规范化确认键：UUID 与 hex 均小写。 */
export function normalizeNameIssueItemId(value: string) {
  return value.toLowerCase();
}
