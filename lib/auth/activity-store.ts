import "server-only";
import { cookies } from "next/headers";
import {
  ACTIVITY_COOKIE,
  activityCookieOptions,
  clearedActivityCookieOptions,
  readActivitySecret,
  signActivityCookie,
} from "@/lib/auth/activity-cookie";

/** 在登录或活动上报的路由里写下活动 Cookie。没有签名密钥时不写任何值。 */
export async function writeActivityCookie(userId: string, at = Date.now()) {
  const secret = readActivitySecret();
  if (!secret || !userId || userId.includes(".")) return false;
  const jar = await cookies();
  jar.set(ACTIVITY_COOKIE, signActivityCookie(userId, at, secret), activityCookieOptions());
  return true;
}

/** 登出或空闲超时后清掉活动 Cookie。Server Component 写不了 Cookie 时返回 false。 */
export async function clearActivityCookie() {
  try {
    const jar = await cookies();
    jar.set(ACTIVITY_COOKIE, "", clearedActivityCookieOptions());
    return true;
  } catch {
    return false;
  }
}
