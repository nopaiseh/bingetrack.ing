import type { Metadata } from "next";
import PrototypeChrome from "../PrototypeChrome";
import { PanoramaIntro, TypeBoard } from "../PanoramaPieces";
import { MOCK_SUMMARY, MOCK_TYPES, avRuntimePercent, primaryTypes, secondaryTypes } from "../mock-data";

export const metadata: Metadata = {
  title: "媒体全景原型 B",
  robots: { index: false, follow: false },
};

/** 方案 B：影视主层；音书次层含想听／想读。 */
export default function PanoramaSchemeBPage() {
  const movie = MOCK_TYPES[0];
  const series = MOCK_TYPES[1];
  const runtimePercent = avRuntimePercent();

  return (
    <PrototypeChrome
      scheme="b"
      title="主次两层"
      blurb="次层音乐＝已听／想听；图书＝已读／在读／想读。完成进度仍只算影视。"
    >
      <PanoramaIntro
        stats={[
          { label: "电影总计", value: movie.total },
          { label: "电视节目总计", value: series.total },
          { label: "完成进度", value: runtimePercent, accent: true },
        ]}
        footnote={`次层：音乐 ${MOCK_SUMMARY.total_albums} 张（已听 ${MOCK_SUMMARY.listened_albums} · 想听 ${MOCK_SUMMARY.want_albums}）· 图书 ${MOCK_SUMMARY.total_books} 本`}
      />

      <div className="flex flex-col gap-4 md:gap-6">
        <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
          {primaryTypes().map((type) => (
            <TypeBoard key={type.id} type={type} />
          ))}
        </div>

        <div>
          <div className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-fg-muted">
            <span className="h-px w-6 bg-white/20" />
            <span>声音与文字</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
            {secondaryTypes().map((type) => (
              <TypeBoard key={type.id} type={type} compact />
            ))}
          </div>
        </div>
      </div>
    </PrototypeChrome>
  );
}
