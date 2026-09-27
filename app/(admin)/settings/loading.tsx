import { SkeletonBlock } from "@/components/LoadingSkeletons";

/** 读取凭证时保留页头与列表的位置，避免切换过来时内容区空白。 */
export default function SettingsLoading() {
  return <section aria-label="正在加载账号安全" aria-busy="true">
    <div className="surface-panel mb-8 space-y-3 rounded-3xl p-5 sm:p-8"><SkeletonBlock className="h-8 w-40" /><SkeletonBlock className="h-4 w-72 max-w-full" /></div>
    <div className="surface-panel space-y-4 rounded-2xl p-5 sm:p-7">{Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} className="h-14 w-full rounded-xl" />)}</div>
  </section>;
}
