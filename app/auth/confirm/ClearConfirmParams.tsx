"use client";

import { useEffect } from "react";

/** 地址栏里的一次性凭证只在打开时存在；加载后去掉，表单隐藏字段仍用于 POST。 */
export function ClearConfirmParams() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("token_hash") && !url.searchParams.has("type")) return;
    url.searchParams.delete("token_hash");
    url.searchParams.delete("type");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);
  return null;
}
