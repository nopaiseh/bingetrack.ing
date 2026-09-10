/** 管理区读取会话或资料时提供明确等待状态。 */
export default function AdminLoading() {
  return <p role="status" className="surface-panel rounded-2xl p-8 text-sm text-neutral-300">正在读取管理资料…</p>;
}
