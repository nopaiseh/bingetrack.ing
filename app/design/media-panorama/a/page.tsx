import type { Metadata } from "next";
import PrototypeChrome from "../PrototypeChrome";
import { PanoramaIntro, TypeBoard } from "../PanoramaPieces";
import { MOCK_TYPES, percent } from "../mock-data";

export const metadata: Metadata = {
  title: "媒体全景原型 A",
  robots: { index: false, follow: false },
};

/** 方案 A：四类媒体等权 2×2 看板；标题区改为四类总计。 */
export default function PanoramaSchemeAPage() {
  const movie = MOCK_TYPES[0];
  const series = MOCK_TYPES[1];
  const runtimePercent = percent(66, 100);

  return (
    <PrototypeChrome
      scheme="a"
      title="四格并列"
      blurb="电影／电视／音乐／图书四张看板等权并排；标题区改为四类总数。空类保留「暂无收录」弱化态。"
    >
      <PanoramaIntro
        stats={MOCK_TYPES.map((type) => ({
          label: `${type.label}总计`,
          value: type.total,
        }))}
        footnote={`影视完成进度仍可单独显示：${runtimePercent}%（本方案标题区优先展示四类体量）`}
      />

      <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
        {MOCK_TYPES.map((type) => (
          <TypeBoard key={type.id} type={type} />
        ))}
      </div>

      <p className="sr-only">
        参考影视体量：电影 {movie.total}，电视 {series.total}
      </p>
    </PrototypeChrome>
  );
}
