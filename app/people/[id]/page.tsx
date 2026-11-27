import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PersonDetailHeader from "@/components/PersonDetailHeader";
import { PersonRoleWorksSection } from "@/components/PersonWorksGrid";
import { getCachedPersonDetail } from "@/lib/functions/cached-media";
import { SITE_URL } from "@/lib/site";

// 按需生成；人物／credits 变更靠 MEDIA_TAG／PERSON_TAG／person:item 失效。
export const revalidate = false;

/** 构建时不枚举人物 ID。 */
export function generateStaticParams() {
  return [];
}

/** 人物页元数据。 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const person = await getCachedPersonDetail(id);
  if (!person) return { title: "人物未找到" };
  const description = `查看${person.name}的影视、音乐与图书作品。`;
  return {
    title: person.name,
    description,
    openGraph: {
      title: person.name,
      description,
      url: `${SITE_URL}/people/${person.id}`,
      type: "profile",
    },
  };
}

/** 人物公开页：页头 + 按媒体类型／角色分组的作品封面栅格；空分区隐藏。 */
export default async function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = await getCachedPersonDetail(id);
  if (!person) notFound();

  const { works } = person;
  const hasAny =
    works.film_tv.length > 0 || works.music.albums.length > 0 || works.music.songs.length > 0 || works.books.length > 0;

  return (
    <div className="relative text-fg selection:bg-[var(--accent-soft)] selection:text-white font-sans">
      <PersonDetailHeader person={person} />
      <div className="container mx-auto max-w-7xl px-4 pb-8 sm:px-6 md:pb-12 lg:px-8">
        {!hasAny ? (
          <p className="text-sm text-fg-muted">暂无公开作品。</p>
        ) : (
          <>
            <PersonRoleWorksSection
              heading="影视"
              headingId="person-film-tv"
              groups={works.film_tv}
              personId={person.id}
            />
            <PersonRoleWorksSection
              heading="专辑"
              headingId="person-albums"
              groups={works.music.albums}
              personId={person.id}
            />
            <PersonRoleWorksSection
              heading="歌曲"
              headingId="person-songs"
              groups={works.music.songs}
              personId={person.id}
            />
            <PersonRoleWorksSection heading="图书" headingId="person-books" groups={works.books} personId={person.id} />
          </>
        )}
      </div>
    </div>
  );
}
