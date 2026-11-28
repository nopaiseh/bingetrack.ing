import { describe, expect, it } from "vitest";
import { alternateTitleLabel } from "@/lib/alternate-title-label";

describe("alternateTitleLabel", () => {
  it("不能说的秘密／Secret：华语或华人地区用又名", () => {
    expect(alternateTitleLabel({ languages: ["华语"], regions: ["中国大陆"] })).toBe("又名");
    expect(alternateTitleLabel({ languages: ["国语"], regions: ["台湾"] })).toBe("又名");
    expect(alternateTitleLabel({ languages: ["粤语"], regions: ["香港"] })).toBe("又名");
    expect(alternateTitleLabel({ languages: ["普通话"], regions: ["中国"] })).toBe("又名");
    expect(alternateTitleLabel({ languages: ["闽南语"], regions: ["澳门"] })).toBe("又名");
    expect(alternateTitleLabel({ languages: ["zh"], regions: [] })).toBe("又名");
    expect(alternateTitleLabel({ languages: ["cmn"], regions: null })).toBe("又名");
    expect(alternateTitleLabel({ languages: ["YUE"], regions: ["香港"] })).toBe("又名");
    expect(alternateTitleLabel({ languages: [], regions: ["台湾"] })).toBe("又名");
  });

  it("盗梦空间／Inception：外语与非华人地区用原名", () => {
    expect(alternateTitleLabel({ languages: ["英语"], regions: ["美国"] })).toBe("原名");
    expect(alternateTitleLabel({ languages: ["英语", "法语"], regions: ["英国", "美国"] })).toBe("原名");
  });

  it("缺语言与地区时回退原名", () => {
    expect(alternateTitleLabel({})).toBe("原名");
    expect(alternateTitleLabel({ languages: null, regions: null })).toBe("原名");
    expect(alternateTitleLabel({ languages: [], regions: [] })).toBe("原名");
    expect(alternateTitleLabel({ languages: ["  "], regions: ["  "] })).toBe("原名");
  });
});
