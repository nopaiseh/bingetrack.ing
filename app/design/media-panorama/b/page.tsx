import type { Metadata } from "next";
import PrototypeChrome from "../PrototypeChrome";
import { PanoramaIntro, TypeBoard } from "../PanoramaPieces";
import { MOCK_TYPES, percent, primaryTypes, secondaryTypes } from "../mock-data";

export const metadata: Metadata = {
  title: "媒体全景原型 B",
  robots: { index: false, follow: false },
};

/** 方案 B：电影／电视保持主看板；音乐／图书压缩为次层。 */
export default function PanoramaSchemeBPage() {
  const movie = MOCK_TYPES[0];
  const series = MOCK_TYPES[1];
  const album = MOCK_TYPES[2];
  const book = MOCK_TYPES[3];
  const runtimePercent = percent(66, 100);

  return (
    <PrototypeChrome
      scheme="b"
      title="主次两层"
      blurb="标题区与主看板仍以电影／电视为主；音乐／图书作为次层紧凑卡，体量较小时不抢视觉权重。"
    >
      <PanoramaIntro
        stats={[
          { label: "电影总计", value: movie.total },
          { label: "电视节目总计", value: series.total },
          { label: "完成进度", value: runtimePercent, accent: true },
        ]}
        footnote={`次层：音乐 ${album.total} 张 · 图书 ${book.total} 本`}
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
