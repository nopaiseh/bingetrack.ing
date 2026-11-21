import type { Metadata } from "next";
import PersonFilterDesignClient from "./PersonFilterDesignClient";

export const metadata: Metadata = {
  title: "人物筛选方案预览",
  robots: { index: false, follow: false },
};

/** 临时设计预览：对比人物角色筛选的三种前端方案，不接真实搜索。 */
export default async function PersonFilterDesignPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.option) ? params.option[0] : params.option;
  const option = raw === "a" || raw === "b" || raw === "c" ? raw : "a";
  return <PersonFilterDesignClient option={option} />;
}
