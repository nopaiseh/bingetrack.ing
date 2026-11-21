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
      blurb="字段对齐 PR #229：total_albums／listened_albums／want_albums；total_books／read_books／reading_books／want_books。完成进度仍只算影视。"
    >
      <PanoramaIntro
        stats={[
          ...MOCK_TYPES.map((type) => ({
            label: `${type.label}总计`,
            value: type.total,
          })),
          { label: "完成进度", value: runtimePercent, accent: true },
        ]}
        footnote="完成进度 = 影视片长（#229 不改时长列）。want_* 仅计 want_to_watch，无 tracking 不计。"
      />

      <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
        {MOCK_TYPES.map((type) => (
          <TypeBoard key={type.id} type={type} />
        ))}
      </div>
    </PrototypeChrome>
  );
}
