import { AdminLoadingSkeleton } from "@/components/LoadingSkeletons";

/** 管理区读取会话或资料时展示完整的后台骨架屏。 */
export default function AdminLoading() {
  return (
    <>
      <h1 className="sr-only">管理</h1>
      <AdminLoadingSkeleton />
    </>
  );
}

