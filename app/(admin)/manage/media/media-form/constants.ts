import type { ManagedMediaType } from "@/lib/admin/media-form";

export const deleteLabels: Record<ManagedMediaType, string> = {
  movie: "删除这部电影…",
  tv_show: "删除这部电视节目…",
  tv_season: "删除这一季…",
  tv_episode: "删除这一集…",
  album: "删除这张专辑…",
  book: "删除这本图书…",
  music: "删除这首曲目…",
};

export const deleteHints: Record<ManagedMediaType, string> = {
  movie: "删除后会同时移除观看记录和演员关联，且无法恢复。",
  tv_show: "删除后会同时移除下属季、集、观看记录和演员关联，且无法恢复。",
  tv_season: "删除后会同时移除这一季的单集和观看记录，且无法恢复。",
  tv_episode: "删除后会同时移除观看记录，且无法恢复。",
  album: "删除后会同时移除下属曲目、收听记录和艺人关联，且无法恢复。",
  music: "删除后会同时移除收听记录和作词作曲关联，且无法恢复。",
  book: "删除后会同时移除阅读记录和作者关联，且无法恢复。",
};
