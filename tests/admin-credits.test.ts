import { describe, expect, it } from "vitest";
import { groupCredits, type CreditRow } from "@/lib/admin/credits";

const media = (id: string, type: string, release_date: string | null, title = id) => ({ id, title, type, release_date });

describe("groupCredits", () => {
  it("merges roles for the same work, director first", () => {
    const film = media("a", "movie", "2020-01-01");
    const rows: CreditRow[] = [
      { media_item_id: "a", role: "actor", character_name: "阿星", media_items: film },
      { media_item_id: "a", role: "director", media_items: film },
    ];
    const [group] = groupCredits(rows);
    expect(group.works).toHaveLength(1);
    expect(group.works[0].roles).toEqual(["director", "actor"]);
    expect(group.works[0].characters).toEqual(["阿星"]);
  });

  it("groups by media type order and sorts by release date desc with undated last", () => {
    const rows: CreditRow[] = [
      { media_item_id: "s", role: "actor", media_items: media("s", "tv_show", "2019-05-01") },
      { media_item_id: "old", role: "actor", media_items: media("old", "movie", "1994-01-01") },
      { media_item_id: "tbd", role: "actor", media_items: media("tbd", "movie", null) },
      { media_item_id: "new", role: "actor", media_items: media("new", "movie", "2024-01-01") },
    ];
    const groups = groupCredits(rows);
    expect(groups.map(g => [g.type, g.label])).toEqual([["movie", "电影"], ["tv_show", "电视节目"]]);
    expect(groups[0].works.map(w => w.media.id)).toEqual(["new", "old", "tbd"]);
  });

  it("skips rows whose media could not be read", () => {
    expect(groupCredits([{ media_item_id: "x", role: "actor", media_items: null }])).toEqual([]);
  });
});
