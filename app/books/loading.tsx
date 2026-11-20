import { CatalogLoadingSkeleton } from "@/components/LoadingSkeletons";

/** 在图书目录加载期间显示统计与海报列表骨架。 */
export default function Loading() {
  return (
    <>
      <h1 className="sr-only">图书</h1>
      <CatalogLoadingSkeleton />
    </>
  );
}
