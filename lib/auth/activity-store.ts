import "server-only";
import { cookies } from "next/headers";
import {
  ACTIVITY_COOKIE,
  activityCookieOptions,
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
