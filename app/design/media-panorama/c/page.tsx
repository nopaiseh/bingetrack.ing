import type { Metadata } from "next";
import PrototypeChrome from "../PrototypeChrome";
import { DensityRow, PanoramaIntro } from "../PanoramaPieces";
import { MOCK_TYPES, avRuntimePercent } from "../mock-data";

export const metadata: Metadata = {
  title: "媒体全景原型 C",
  robots: { index: false, follow: false },
};

/** 方案 C：密度行；每行只渲染后端实际提供的状态列。 */
export default function PanoramaSchemeCPage() {
  const runtimePercent = avRuntimePercent();
  const catalogTotal = MOCK_TYPES.reduce((sum, type) => sum + type.total, 0);

  return (
    <PrototypeChrome
      scheme="c"
      title="密度行"
      blurb="四类各一行。音乐行：已听＋总计；图书行：已读＋在读。标题完成进度仍只算影视片长，音书不并入。"
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
