import { DetailLoadingSkeleton } from "@/components/LoadingSkeletons";

/** 在图书详情加载期间显示详情骨架。 */
export default function Loading() {
  return (
    <>
      <h1 className="sr-only">图书详情</h1>
      <DetailLoadingSkeleton />
    </>
  );
}
