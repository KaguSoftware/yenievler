import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, hasLocale, pickLocale } from "@/i18n/config";

/** Sends a bare path such as "/" to "/en" or "/tr", by the saved choice, else Turkish. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1];
  if (hasLocale(first)) return;

  const url = request.nextUrl.clone();
  url.pathname = `/${pickLocale(request.cookies.get(LOCALE_COOKIE)?.value)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals and anything with a file extension (favicon, images, fonts).
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
