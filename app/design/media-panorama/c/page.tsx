import type { Metadata } from "next";
import PrototypeChrome from "../PrototypeChrome";
import { DensityRow, PanoramaIntro } from "../PanoramaPieces";
import { MOCK_TYPES, avRuntimePercent } from "../mock-data";

export const metadata: Metadata = {
  title: "媒体全景原型 C",
  robots: { index: false, follow: false },
};

/** 方案 C：密度行；音乐已听｜想听，图书已读｜在读｜想读。 */
export default function PanoramaSchemeCPage() {
  const runtimePercent = avRuntimePercent();
  const catalogTotal = MOCK_TYPES.reduce((sum, type) => sum + type.total, 0);

  return (
    <PrototypeChrome
      scheme="c"
      title="密度行"
      blurb="（非定稿）密度行示意；定稿见方案 A。音乐已改为歌曲列 total_tracks／listened_tracks／want_tracks。"
    >
      <PanoramaIntro
        stats={[
          ...MOCK_TYPES.map((type) => ({
            label: type.label,
            value: type.total,
          })),
          { label: "完成进度", value: runtimePercent, accent: true },
        ]}
        footnote={`四类合计 ${catalogTotal}；完成进度仅影视（${runtimePercent}%）`}
      />

      <div className="flex flex-col gap-3 md:gap-4">
        {MOCK_TYPES.map((type) => (
          <DensityRow key={type.id} type={type} />
        ))}
      </div>
    </PrototypeChrome>
  );
}
