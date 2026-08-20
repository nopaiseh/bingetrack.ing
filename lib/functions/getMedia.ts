import { getMediaById } from '@/lib/functions/media-repo';
import { Media } from '@/lib/types/Media';
import { MediaType } from '@/lib/functions/media-mapper';

// 兼容层：旧的 getMedia 包装，委托给 media-repo（保持向后兼容）
export async function getMedia(id: string, type: MediaType): Promise<Media | null> {
  return getMediaById(id, type);
}
