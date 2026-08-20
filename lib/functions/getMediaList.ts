import { getRelatedBySeries, fetchMediaListServer } from '@/lib/functions/media-repo';
import { Media } from '@/lib/types/Media';

// 兼容层：旧的 getMediaList 封装，尽量委托给 media-repo
export async function getMediaList({ seriesName, currentId, mode }: { seriesName: string; currentId: string; mode: 'movies' | 'series' }): Promise<Media[] | null> {
  if (seriesName && mode === 'movies') {
    // 使用 media-repo 的系列相关查询
    return getRelatedBySeries(seriesName, currentId, mode as any) as Promise<Media[] | null>;
  }

  // 否则使用通用的 fetchMediaListServer（注意返回结构为 { rows, total }）
  const mediaType = mode === 'movies' ? 'movie' : 'tv_series';
  const res = await fetchMediaListServer({ type: mediaType, limit: 50, offset: 0 });
  return res.rows ?? null;
}
