import { HomeLoadingSkeleton } from "@/components/LoadingSkeletons";

/** 在首页加载期间显示看板骨架。 */
export default function Loading() {
  return (
    <>
      <h1 className="sr-only">媒体全景</h1>
      <HomeLoadingSkeleton />
    </>
  );
}
