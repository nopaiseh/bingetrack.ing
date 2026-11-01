import { buildPageSocialMetadata } from "@/lib/seo/page";

export const metadata = buildPageSocialMetadata(
  "搜索",
  "按标题、演职员、类型、年份、地区与语言检索媒体记录。",
  "/search",
);

/** 直接透传搜索页内容，由该路由布局提供统一元数据。 */
export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
