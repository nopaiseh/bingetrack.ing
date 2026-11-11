import { beforeEach, expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({
  result: { data: null, error: null } as { data: unknown; error: unknown },
  client: vi.fn(),
}));
vi.mock("@/lib/supabase/public-server", () => ({ getSupabasePublicServer: state.client }));
import { getMediaById, getSeasonsBySeriesId, getSeasonEpisodes, getSeasonNextEpisodeNumber, MediaRepositoryError } from "@/lib/functions/media-repo";

const id = "12345678-1234-1234-1234-123456789abc";
beforeEach(() => {
  state.result = { data: null, error: null };
  state.client.mockReset();
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => Promise.resolve({ data: [], error: null }),
    maybeSingle: () => Promise.resolve(state.result),
  };
  state.client.mockReturnValue({ from: () => chain, rpc: () => Promise.resolve(state.result) });
});

test.each(["null", "undefined", "", "bad-id", "123", `${id}x`, ` ${id}`, id.replace("a", "g")])("invalid ID %s never reaches the database", async (invalid) => {
  expect(await getMediaById(invalid)).toBeNull();
  expect(await getSeasonsBySeriesId(invalid)).toEqual([]);
  expect(await getSeasonEpisodes(invalid, id, 1, 10)).toBeNull();
  expect(await getSeasonEpisodes(id, invalid, 1, 10)).toBeNull();
  expect(state.client).not.toHaveBeenCalled();
});

test("valid but missing media and seasons return not-found results", async () => {
  expect(await getMediaById(id)).toBeNull();
  expect(await getSeasonEpisodes(id, id, 1, 10)).toBeNull();
  expect(state.client).toHaveBeenCalledTimes(2);
});

test("valid media still loads, including uppercase UUIDs", async () => {
  state.result.data = { id, type: "movie", title: "Movie" };
  expect(await getMediaById(id.toUpperCase())).toMatchObject({ id, title: "Movie" });
});

test("next episode is the first unwatched number after the last watched one", async () => {
  expect(await getSeasonNextEpisodeNumber("bad-id", id)).toBeNull();
  expect(state.client).not.toHaveBeenCalled();

  const rows = [
    { episode_number: 1, media: { tracking: { status: "watched" } } },
    { episode_number: 3, media: { tracking: [{ status: "watched" }] } },
    { episode_number: 4, media: { tracking: null } },
  ];
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    range: () => Promise.resolve({ data: rows, error: null }),
  };
  state.client.mockReturnValueOnce({ from: () => builder, rpc: () => Promise.resolve(state.result) });
  expect(await getSeasonNextEpisodeNumber(id, id)).toBe(4);
});

test("watch progress failures keep their original cause", async () => {
  const error = { code: "42501", message: "permission denied" };
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    range: () => Promise.resolve({ data: null, error }),
  };
  state.client.mockReturnValue({ from: () => builder, rpc: () => Promise.resolve(state.result) });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await expect(getSeasonNextEpisodeNumber(id, id)).rejects.toMatchObject({ name: "MediaRepositoryError", cause: error });
  } finally {
    log.mockRestore();
  }
});

test("real database failures retain their original cause", async () => {
  const error = { code: "42501", message: "permission denied" };
  state.result.error = error;
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await expect(getMediaById(id)).rejects.toMatchObject({ name: "MediaRepositoryError", cause: error });
    await expect(getSeasonEpisodes(id, id, 1, 10)).rejects.toBeInstanceOf(MediaRepositoryError);
  } finally {
    log.mockRestore();
  }
});
