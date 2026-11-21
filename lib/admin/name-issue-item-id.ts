import { isMediaId } from "@/lib/functions/media-id";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** 报告行 id：people:<uuid> 或 credit:<media>:<person>:<utf8-hex(角色名)>。 */
const NAME_ISSUE_ITEM_ID = new RegExp(`^(people:${UUID}|credit:${UUID}:${UUID}:[0-9a-f]+)$`, "i");

/** 人物名确认键，与 manage_name_issue_people_item_id 一致。 */
export function peopleNameIssueItemId(personId: string) {
  return `people:${personId.toLowerCase()}`;
}

/** 角色名确认键；角色名 UTF-8 hex，避免「:」与大小写折叠问题。与 manage_name_issue_credit_item_id 一致。 */
export function creditNameIssueItemId(mediaItemId: string, personId: string, characterName: string) {
  const hex = Buffer.from(characterName, "utf8").toString("hex");
  return `credit:${mediaItemId.toLowerCase()}:${personId.toLowerCase()}:${hex}`;
}

/** 校验确认键格式（应用提交前）。 */
export function isNameIssueItemId(value: string) {
  return NAME_ISSUE_ITEM_ID.test(value);
}

/** 规范化确认键：UUID 与 hex 均小写。 */
export function normalizeNameIssueItemId(value: string) {
  return value.toLowerCase();
}

/** 解析确认键；格式不对时返回 null。 */
export function parseNameIssueItemId(value: string) {
  const itemId = normalizeNameIssueItemId(value);
  if (!isNameIssueItemId(itemId)) return null;
  if (itemId.startsWith("people:")) {
    const personId = itemId.slice("people:".length);
    return isMediaId(personId) ? ({ kind: "people", personId } as const) : null;
  }
  const [, mediaItemId, personId, characterHex] = itemId.split(":");
  if (!isMediaId(mediaItemId) || !isMediaId(personId) || !characterHex) return null;
  try {
    const characterName = Buffer.from(characterHex, "hex").toString("utf8");
    if (!characterName) return null;
    return { kind: "credit", mediaItemId, personId, characterName } as const;
  } catch {
    return null;
  }
}
