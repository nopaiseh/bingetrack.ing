import type { Metadata } from "next";
import PrototypeChrome from "../PrototypeChrome";
import { PanoramaIntro, TypeBoard } from "../PanoramaPieces";
import { MOCK_TYPES, avRuntimePercent } from "../mock-data";

export const metadata: Metadata = {
  title: "媒体全景原型 A",
  robots: { index: false, follow: false },
};

/** 方案 A：四类等权；音书字段对齐 release_year_stats 扩展列。 */
export default function PanoramaSchemeAPage() {
  const runtimePercent = avRuntimePercent();

  return (
    <PrototypeChrome
      scheme="a"
      title="四格并列"
      blurb="标题区四类总数 + 影视完成进度。音乐只展示已听（及总数），图书展示已读／在读；完成进度仍只算影视片长。"
    >
      <PanoramaIntro
        stats={[
          ...MOCK_TYPES.map((type) => ({
            label: `${type.label}总计`,
            value: type.total,
          })),
          { label: "完成进度", value: runtimePercent, accent: true },
        ]}
        footnote="完成进度 = 影视已看片长／总片长；专辑与图书不并入"
      />

      <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
        {MOCK_TYPES.map((type) => (
          <TypeBoard key={type.id} type={type} />
        ))}
      </div>
    </PrototypeChrome>
  );
}
