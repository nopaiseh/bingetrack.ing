import { describe, expect, it } from "vitest";
import { formatTrackDuration, ownershipLabel } from "@/lib/album-display";
import { listenStatusLabel } from "@/lib/listen-status";

describe("album display helpers", () => {
  it("formats track duration as m:ss from seconds", () => {
    expect(formatTrackDuration(65)).toBe("1:05");
    expect(formatTrackDuration(9)).toBe("0:09");
    expect(formatTrackDuration(null)).toBeNull();
    expect(formatTrackDuration(0)).toBeNull();
  });

  it("labels ownership and listening status", () => {
    expect(ownershipLabel("owned")).toBe("已拥有");
    expect(ownershipLabel("want_to_own")).toBe("想拥有");
    expect(ownershipLabel(null)).toBeNull();
    expect(listenStatusLabel("watched")).toBe("听过");
    expect(listenStatusLabel("want_to_watch")).toBe("想听");
    expect(listenStatusLabel("watching")).toBe("在听");
    expect(listenStatusLabel(null)).toBeNull();
  });
});
