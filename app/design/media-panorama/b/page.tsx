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
      blurb="（非定稿）次层示意；定稿见方案 A。音乐已改为歌曲列 total_tracks／listened_tracks／want_tracks。"
    >
      <PanoramaIntro
        stats={[
          { label: "电影总计", value: movie.total },
          { label: "电视节目总计", value: series.total },
          { label: "完成进度", value: runtimePercent, accent: true },
        ]}
        footnote={`次层：音乐 total_tracks=${MOCK_SUMMARY.total_tracks}（listened=${MOCK_SUMMARY.listened_tracks} · want_tracks=${MOCK_SUMMARY.want_tracks}）· 图书 total_books=${MOCK_SUMMARY.total_books}`}
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
