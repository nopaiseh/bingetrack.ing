import { requireOwner } from "@/lib/auth/server";
import PageHeader, { AdminCrumb } from "../../../PageHeader";
import RematchCoversClient from "./RematchCoversClient";

export const metadata = { title: "重新匹配音乐封面" };
/** 预览需串行打 iTunes 多区，放宽至 60s 以容纳一批 ≤50 条。 */
export const maxDuration = 60;

/** 站长工具：仅处理 *.mzstatic.com 封面；预览后勾选再提交。 */
export default async function RematchCoversPage() {
  await requireOwner();
  return (
    <section>
      <PageHeader
        eyebrow={<AdminCrumb current="重新匹配音乐封面" />}
        title="重新匹配音乐封面"
        description="只针对封面主机为 *.mzstatic.com 的专辑。曲目封面跟所属专辑，不在此重配。先预览新规则解析结果，勾选后再提交；未勾选的不动。手填的非 mzstatic 封面不会出现在此列表。"
      />
      <RematchCoversClient />
    </section>
  );
}
