import { NextRequest, NextResponse } from "next/server";
import { COOKIE, verifier } from "./lib/jwt";

// Toute page hors /login exige une session valide.
export async function middleware(req: NextRequest) {
  const ok = await verifier(req.cookies.get(COOKIE)?.value);
  if (ok) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ erreur: "Session expirée" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
