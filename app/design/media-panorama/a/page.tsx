import type { Metadata } from "next";
import PrototypeChrome from "../PrototypeChrome";
import { PanoramaIntro, TypeBoard } from "../PanoramaPieces";
import { MOCK_TYPES, avRuntimePercent } from "../mock-data";

export const metadata: Metadata = {
  title: "媒体全景原型 A",
  robots: { index: false, follow: false },
};

/** 方案 A：四格并列；专辑已听／想听，图书已读／在读／想读。 */
export default function PanoramaSchemeAPage() {
  const runtimePercent = avRuntimePercent();

  return (
    <PrototypeChrome
      scheme="a"
      title="四格并列"
      blurb="专辑看板：总数＋已听＋想听。图书看板：总数＋已读＋在读＋想读。完成进度仍只算影视片长。"
    >
      <PanoramaIntro
        stats={[
          ...MOCK_TYPES.map((type) => ({
            label: `${type.label}总计`,
            value: type.total,
          })),
          { label: "完成进度", value: runtimePercent, accent: true },
        ]}
        footnote="完成进度 = 影视片长；专辑／图书不并入。现网确有想听／想读状态（见报告）。"
      />

      <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
        {MOCK_TYPES.map((type) => (
          <TypeBoard key={type.id} type={type} />
        ))}
      </div>
    </PrototypeChrome>
  );
}
