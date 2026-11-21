import type { Metadata } from "next";
import PrototypeChrome from "../PrototypeChrome";
import { DensityRow, PanoramaIntro } from "../PanoramaPieces";
import { MOCK_TYPES, percent } from "../mock-data";

export const metadata: Metadata = {
  title: "媒体全景原型 C",
  robots: { index: false, follow: false },
};

/** 方案 C：标题区四类总计 + 总览用密度行，手机上一屏可扫完四类。 */
export default function PanoramaSchemeCPage() {
  const runtimePercent = percent(66, 100);
  const catalogTotal = MOCK_TYPES.reduce((sum, type) => sum + type.total, 0);

  return (
    <PrototypeChrome
      scheme="c"
      title="密度行"
      blurb="四类各占一行：左侧体量、中间三态、底部细进度条。零数据不占大卡，扫描成本最低，适合后续再开音乐／图书独立标签。"
    >
      <PanoramaIntro
        stats={[
          ...MOCK_TYPES.map((type) => ({
            label: type.label,
            value: type.total,
          })),
          { label: "完成进度", value: runtimePercent, accent: true },
        ]}
        footnote={`四类合计 ${catalogTotal}；完成进度仍按影视片长口径（与现网一致）`}
      />

      <div className="flex flex-col gap-3 md:gap-4">
        {MOCK_TYPES.map((type) => (
          <DensityRow key={type.id} type={type} />
        ))}
      </div>
    </PrototypeChrome>
  );
}
