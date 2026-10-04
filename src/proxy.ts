import { NextResponse, type NextRequest } from "next/server";
import { hasLocale, pickLocale } from "@/i18n/config";

/** Sends a bare path such as "/" to "/en" or "/tr", by the browser's Accept-Language. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1];
  if (hasLocale(first)) return;

  const url = request.nextUrl.clone();
  url.pathname = `/${pickLocale(request.headers.get("accept-language"))}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals and anything with a file extension (favicon, images, fonts).
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
