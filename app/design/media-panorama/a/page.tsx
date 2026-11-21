import type { Metadata } from "next";
import PrototypeChrome from "../PrototypeChrome";
import { PanoramaIntro, TypeBoard } from "../PanoramaPieces";
import { MOCK_SUMMARY, MOCK_TYPES, avRuntimePercent } from "../mock-data";

export const metadata: Metadata = {
  title: "媒体全景定稿 · 方案 A",
  robots: { index: false, follow: false },
};

/** 定稿方案 A：四格并列；音乐按歌曲数（首）。 */
export default function PanoramaSchemeAPage() {
  const runtimePercent = avRuntimePercent();

  return (
    <PrototypeChrome
      scheme="a"
      title="四格并列（定稿）"
      blurb={`音乐按歌曲：total_tracks=${MOCK_SUMMARY.total_tracks}／listened_tracks=${MOCK_SUMMARY.listened_tracks}／want_tracks=${MOCK_SUMMARY.want_tracks}（首，含专辑内与单曲）。图书仍用 #229 四列。完成进度只算影视。`}
    >
      <PanoramaIntro
        stats={[
          ...MOCK_TYPES.map((type) => ({
            label: `${type.label}总计`,
            value: type.total,
          })),
          { label: "完成进度", value: runtimePercent, accent: true },
        ]}
        footnote="完成进度 = 影视片长。音乐单位「首」；图书单位「本」。"
      />

      <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
        {MOCK_TYPES.map((type) => (
          <TypeBoard key={type.id} type={type} />
        ))}
      </div>
    </PrototypeChrome>
  );
}
