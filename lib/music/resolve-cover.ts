/**
 * 服务端封面解析：只返回可写入 cover_url 的绝对 URL，不持久化 MusicBrainz／iTunes 等外部 ID。
 * 顺序：iTunes Search →（临时查 MusicBrainz 取 release MBID）Cover Art Archive → null。
 * CAA 依赖 MusicBrainz 检索；MBID 仅在本次请求内存中使用，绝不写入数据库。
 */

export type MusicCoverEntity = "album" | "song";

export type ResolveMusicCoverInput = {
  title: string;
  artist?: string | null;
  entity: MusicCoverEntity;
};

export type ResolveMusicCoverDeps = {
  fetch?: typeof fetch;
};

const ITUNES_SEARCH = "https://itunes.apple.com/search";
const MUSICBRAINZ_SEARCH = "https://musicbrainz.org/ws/2/release";
const COVER_ART_ARCHIVE = "https://coverartarchive.org/release";

/** iTunes 默认封面多为 100x100；替换为更大尺寸供站点展示。 */
export function upscaleItunesArtworkUrl(url: string, size = 600): string {
  return url.replace(/\/\d+x\d+bb(?:-\d+)?(\.[a-z]+)(?:\?.*)?$/i, `/${size}x${size}bb$1`);
}

type ItunesResult = {
  artworkUrl100?: string;
  artworkUrl60?: string;
  collectionName?: string;
  trackName?: string;
};

type ItunesResponse = { results?: ItunesResult[] };

function buildItunesQuery(input: ResolveMusicCoverInput): URL {
  const term = [input.artist?.trim(), input.title.trim()].filter(Boolean).join(" ");
  const url = new URL(ITUNES_SEARCH);
  url.searchParams.set("term", term);
  url.searchParams.set("entity", input.entity === "song" ? "song" : "album");
  url.searchParams.set("limit", "5");
  return url;
}

function pickItunesArtwork(results: ItunesResult[] | undefined, input: ResolveMusicCoverInput): string | null {
  if (!results?.length) return null;
  const titleKey = input.title.trim().toLowerCase();
  const ranked = [...results].sort((left, right) => {
    const leftName = (input.entity === "song" ? left.trackName : left.collectionName)?.toLowerCase() ?? "";
    const rightName = (input.entity === "song" ? right.trackName : right.collectionName)?.toLowerCase() ?? "";
    return Number(rightName === titleKey) - Number(leftName === titleKey);
  });
  for (const row of ranked) {
    const art = row.artworkUrl100 ?? row.artworkUrl60;
    if (art) return upscaleItunesArtworkUrl(art);
  }
  return null;
}

async function resolveFromItunes(input: ResolveMusicCoverInput, fetchImpl: typeof fetch): Promise<string | null> {
  const response = await fetchImpl(buildItunesQuery(input), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as ItunesResponse;
  return pickItunesArtwork(body.results, input);
}

type MusicBrainzReleaseList = {
  releases?: Array<{ id?: string; title?: string; score?: number }>;
};

/**
 * 临时向 MusicBrainz 查询 release MBID，仅用于随后请求 Cover Art Archive。
 * 返回的 ID 不落库；查找失败或无封面时整体回退为 null。
 */
async function resolveFromCoverArtArchive(
  input: ResolveMusicCoverInput,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  const queryParts = [`release:"${input.title.replaceAll('"', "")}"`];
  if (input.artist?.trim()) queryParts.push(`artist:"${input.artist.replaceAll('"', "")}"`);
  const mbUrl = new URL(MUSICBRAINZ_SEARCH);
  mbUrl.searchParams.set("query", queryParts.join(" AND "));
  mbUrl.searchParams.set("fmt", "json");
  mbUrl.searchParams.set("limit", "5");

  const mbResponse = await fetchImpl(mbUrl, {
    headers: {
      Accept: "application/json",
      // MusicBrainz 要求可识别的 User-Agent。
      "User-Agent": "bingetrack.ing/music-cover (https://bingetrack.ing)",
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!mbResponse.ok) return null;
  const mbBody = (await mbResponse.json()) as MusicBrainzReleaseList;
  const releaseId = mbBody.releases?.find((row) => row.id)?.id;
  if (!releaseId) return null;

  const caaUrl = `${COVER_ART_ARCHIVE}/${encodeURIComponent(releaseId)}/front-500`;
  const caaResponse = await fetchImpl(caaUrl, {
    method: "HEAD",
    redirect: "follow",
    signal: AbortSignal.timeout(8_000),
  });
  if (!caaResponse.ok) return null;
  // 跟随重定向后的最终 URL（常落在 archive.org）；不保存 releaseId。
  return caaResponse.url || caaUrl;
}

/**
 * 解析专辑／单曲封面 URL。全部外部调用失败时返回 null，前端用首字母字块占位。
 */
export async function resolveMusicCover(
  input: ResolveMusicCoverInput,
  deps: ResolveMusicCoverDeps = {},
): Promise<string | null> {
  const title = input.title?.trim();
  if (!title) return null;
  const fetchImpl = deps.fetch ?? fetch;
  const normalized = { ...input, title };

  try {
    const itunes = await resolveFromItunes(normalized, fetchImpl);
    if (itunes) return itunes;
  } catch {
    /* 继续尝试 CAA */
  }

  try {
    return await resolveFromCoverArtArchive(normalized, fetchImpl);
  } catch {
    return null;
  }
}
