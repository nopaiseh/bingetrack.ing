import { DetailLoadingSkeleton } from "@/components/LoadingSkeletons";

/** 在电视节目详情加载期间显示详情骨架。 */
export default function Loading() {
  return (
    <>
      <h1 className="sr-only">电视节目详情</h1>
      <DetailLoadingSkeleton />
    </>
  );
}
