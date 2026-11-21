import type { Metadata } from "next";
import PrototypeChrome from "../PrototypeChrome";
import { PanoramaIntro, TypeBoard } from "../PanoramaPieces";
import { MOCK_TYPES, avRuntimePercent, primaryTypes, secondaryTypes } from "../mock-data";

export const metadata: Metadata = {
  title: "媒体全景原型 B",
  robots: { index: false, follow: false },
};

/** 方案 B：影视主层；音书次层，字段仅用后端将提供的列。 */
export default function PanoramaSchemeBPage() {
  const movie = MOCK_TYPES[0];
  const series = MOCK_TYPES[1];
  const album = MOCK_TYPES[2];
  const book = MOCK_TYPES[3];
  const runtimePercent = avRuntimePercent();

  return (
    <PrototypeChrome
      scheme="b"
      title="主次两层"
      blurb="标题区保持电影／电视／完成进度。次层音乐＝总数＋已听；图书＝总数＋已读＋在读。完成进度仍只算影视。"
    >
      <PanoramaIntro
        stats={[
          { label: "电影总计", value: movie.total },
          { label: "电视节目总计", value: series.total },
          { label: "完成进度", value: runtimePercent, accent: true },
        ]}
        footnote={`次层：音乐 ${album.total} 张（已听 ${album.statuses[0]?.count ?? 0}）· 图书 ${book.total} 本`}
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
