import { mediaTypes } from "./media-form";
import { referenceTypes } from "./catalog";

/** 报告与数据库视图的固定映射，服务端不能接受任意视图名。bulkDelete 为批量删除时传给 manage_delete_unused 的类别。 */
export const reports = {
  "missing-alias": { group: "人物与演员表", label: "未填别名的人物", view: "v_report_missing_alias", icon: "i-material-symbols-badge-outline-rounded", description: "尚未填写别名的人物，参与作品多的排在前面。", unit: "位人物" },
  "missing-character": { group: "人物与演员表", label: "未填角色名", view: "v_report_missing_character", icon: "i-material-symbols-theater-comedy-outline-rounded", description: "演员表中尚未填写饰演角色的作品，标签为未填写的演员。", unit: "部作品" },
  "suspicious-names": { group: "人物与演员表", label: "疑似名字错误", view: "v_report_suspicious_names", icon: "i-material-symbols-spellcheck-rounded", description: "按写法规则找出可疑的人物名与角色名，仅供参考，请逐一确认。", unit: "项" },
  "similar-people": { group: "人物与演员表", label: "疑似重复人物", view: "v_report_similar_people", icon: "i-material-symbols-group-work-outline-rounded", description: "忽略大小写、全角半角、空格与标点后名字相同的人物；同名但别名各异的不列出。标签为相似的其他人物。", unit: "位人物" },
  "orphan-people": { group: "人物与演员表", label: "未关联作品的人物", view: "v_report_orphan_people", icon: "i-material-symbols-person-off-outline-rounded", description: "没有参与任何作品、也不是专辑艺术家的人物。", unit: "位人物", bulkDelete: "people" },
  "credit-order": { group: "人物与演员表", label: "演职员顺序异常", view: "v_report_credit_order", icon: "i-material-symbols-format-list-numbered-rounded", description: "演员或导演顺序重复、断号或为空。打开作品重新保存即可按当前顺序修正。", unit: "部作品" },
  "incomplete-media": { group: "作品资料", label: "资料不完整", view: "v_report_incomplete_media", icon: "i-material-symbols-edit-note-rounded", description: "电影、电视节目缺少的字段；单集只检查播出日期。", unit: "个条目" },
  "tv-structure": { group: "作品资料", label: "季集结构", view: "v_report_tv_structure", icon: "i-material-symbols-account-tree-outline-rounded", description: "没有季的电视节目、没有单集的季，以及季号、集号断号（编号 0 的特别篇不计）。", unit: "个条目" },
  "tracking-conflicts": { group: "作品资料", label: "观看记录矛盾", view: "v_report_tracking_conflicts", icon: "i-material-symbols-rule-rounded", description: "想看却已有评分的电影和单集，以及已看但未评分的电影。", unit: "个条目" },
  "unused-references": { group: "关联资料", label: "闲置关联资料", view: "v_report_unused_references", icon: "i-material-symbols-label-off-outline-rounded", description: "没有被任何作品使用的类型、地区、语言与系列。", unit: "项资料", bulkDelete: "references" },
} as const;
export type ReportKind = keyof typeof reports;
export type ReportRow = { id: string; link_type: string; link_id: string; title: string; detail: string | null; tags: string[] | null; weight: number };

/** 只允许已定义的报告。 */
export function isReportKind(value: string): value is ReportKind {
  return Object.hasOwn(reports, value);
}

/** 按分组排列报告，概览页与导航共用顺序。 */
export function reportGroups() {
  const groups = new Map<string, ReportKind[]>();
  for (const kind of Object.keys(reports) as ReportKind[]) groups.set(reports[kind].group, [...(groups.get(reports[kind].group) ?? []), kind]);
  return [...groups].map(([label, kinds]) => ({ label, kinds }));
}

/** 视图返回的问题代码；未列出的标签（如演员名）原样显示。 */
export const reportTagLabels: Record<string, string> = {
  edge_space: "首尾有空格",
  double_space: "连续空格",
  invisible_char: "含不可见字符",
  fullwidth: "含全角字母、数字或空格",
  bracket_note: "含括号备注",
  placeholder: "占位文字",
  edge_punct: "首尾有标点",
  separator: "多角色未用「 / 」分隔",
  mixed_script: "中英文混写",
  digits: "含数字",
  too_long: "名字过长",
  same_as_actor: "与演员同名",
  no_cover: "缺封面",
  no_summary: "缺简介",
  no_release_date: "缺上映日期",
  no_genres: "缺类型",
  no_regions: "缺地区",
  no_languages: "缺语言",
  no_actors: "缺演员",
  no_directors: "缺导演",
  no_seasons: "没有季",
  season_gap: "季号断号",
  no_episodes: "没有单集",
  episode_gap: "集号断号",
  rating_unwatched: "想看但有评分",
  watched_unrated: "已看但未评分",
  actor_order: "演员顺序",
  director_order: "导演顺序",
  ...Object.fromEntries(Object.entries(referenceTypes).map(([kind, config]) => [kind, config.label])),
};

/** 报告行的修正入口：媒体进入编辑页，关联资料进入资料详情。 */
export function reportRowHref(row: Pick<ReportRow, "link_type" | "link_id">) {
  if (Object.hasOwn(mediaTypes, row.link_type)) return `/manage/media/${row.link_id}?type=${row.link_type}`;
  return `/manage/references/${row.link_type}/${row.link_id}`;
}

/** 报告行的类别说明，如「电影」或「人物」。 */
export function reportRowType(linkType: string) {
  if (Object.hasOwn(mediaTypes, linkType)) return mediaTypes[linkType as keyof typeof mediaTypes];
  if (Object.hasOwn(referenceTypes, linkType)) return referenceTypes[linkType as keyof typeof referenceTypes].label;
  return "";
}
