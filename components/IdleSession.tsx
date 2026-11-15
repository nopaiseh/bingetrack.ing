"use client";

import { useIdleSession } from "@/lib/auth/use-idle-session";

/** 全站空闲登出。必须挂在 HideOnAdmin 之外，否则 /manage 和 /settings 卸掉导航栏后计时也会停止。 */
export default function IdleSession() {
  useIdleSession();
  return null;
}
