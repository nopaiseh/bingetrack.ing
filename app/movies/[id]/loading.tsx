import { DetailLoadingSkeleton } from "@/components/LoadingSkeletons";

/** 在电影详情加载期间显示详情骨架。 */
export default function Loading() {
  return (
    <>
      <h1 className="sr-only">电影详情</h1>
      <DetailLoadingSkeleton />
    </>
  );
}
