import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "搜索",
  description: "按标题、演职员、类型、年份、地区与语言检索媒体记录。",
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
