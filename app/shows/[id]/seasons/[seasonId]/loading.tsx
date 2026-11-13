import { SeasonDetailLoadingSkeleton } from "@/components/LoadingSkeletons";

/** 为季详情的海报、统计、筛选和单集列表展示占位布局。 */
export default function Loading() {
  return (
    <>
      <h1 className="sr-only">季度详情</h1>
      <SeasonDetailLoadingSkeleton />
    </>
  );
}

