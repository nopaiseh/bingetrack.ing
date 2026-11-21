import { notFound } from "next/navigation";
import BookInformation from "@/components/BookInformation";
import { getCachedMediaById } from "@/lib/functions/cached-media";
import { getSupabasePublicServer } from "@/lib/supabase/public-server";
import type { Metadata } from "next";
import { buildMediaJsonLd, buildMediaMetadata, serializeJsonLd } from "@/lib/seo/media";

// 按需生成；只靠保存时的 revalidateTag 失效，不定时重建。
export const revalidate = false;

/** 构建时不枚举详情 ID，访问时按需生成。 */
export function generateStaticParams() {
  return [];
}

/** 用缓存的图书详情生成页面与分享元数据。 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const book = await getCachedMediaById(id);
  if (!book) return { title: "图书未找到" };
  return buildMediaMetadata(book);
}

/** 读取 books 表上的可空出版社／页数；表未迁移时降级为空。 */
async function loadBookMeta(id: string): Promise<{ publisher: string | null; pageCount: number | null }> {
  try {
    const db = getSupabasePublicServer();
    const { data, error } = await db.from("books").select("page_count,publisher").eq("media_item_id", id).maybeSingle();
    if (error || !data) return { publisher: null, pageCount: null };
    return {
      publisher: data.publisher ?? null,
      pageCount: data.page_count != null ? Number(data.page_count) : null,
    };
  } catch {
    return { publisher: null, pageCount: null };
  }
}

/** 读取图书详情；缺失或类型不符时 404。展示作者、出版社、页数与三态阅读状态，无进度条。 */
export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = await getCachedMediaById(id);
  if (!book) notFound();
  if (book.type !== "books") notFound();

  const meta = await loadBookMeta(id);
  const jsonLd = buildMediaJsonLd(book);

  return (
    <div className="relative text-fg selection:bg-[var(--accent-soft)] selection:text-white font-sans">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <BookInformation media={book} publisher={meta.publisher} pageCount={meta.pageCount} />
    </div>
  );
}
