import { describe, expect, it } from "vitest";
import {
  creditNameIssueItemId,
  isNameIssueItemId,
  normalizeNameIssueItemId,
  parseNameIssueItemId,
  peopleNameIssueItemId,
} from "@/lib/admin/name-issue-item-id";

const media = "44444444-4444-4444-8444-444444444444";
const person = "22222222-2222-4222-8222-222222222222";

describe("疑似名字确认键", () => {
  it("人物键与角色键格式正确，角色名以 hex 编码", () => {
    expect(peopleNameIssueItemId(person.toUpperCase())).toBe(`people:${person}`);
    expect(creditNameIssueItemId(media.toUpperCase(), person.toUpperCase(), "英雄/反派")).toBe(
      `credit:${media}:${person}:${Buffer.from("英雄/反派", "utf8").toString("hex")}`,
    );
  });

  it("同一演员同一作品不同角色得到不同键", () => {
    const a = creditNameIssueItemId(media, person, "警察/卧底");
    const b = creditNameIssueItemId(media, person, "英雄/反派");
    expect(a).not.toBe(b);
    expect(isNameIssueItemId(a)).toBe(true);
    expect(isNameIssueItemId(b)).toBe(true);
  });

  it("解析与规范化", () => {
    const itemId = creditNameIssueItemId(media, person, "英雄/反派").toUpperCase();
    expect(normalizeNameIssueItemId(itemId)).toBe(itemId.toLowerCase());
    expect(parseNameIssueItemId(itemId)).toEqual({
      kind: "credit",
      mediaItemId: media,
      personId: person,
      characterName: "英雄/反派",
    });
    expect(parseNameIssueItemId(`people:${person.toUpperCase()}`)).toEqual({ kind: "people", personId: person });
    expect(parseNameIssueItemId("credit:not-a-uuid")).toBeNull();
    expect(isNameIssueItemId(`credit:${media}:${person}`)).toBe(false);
  });
});
