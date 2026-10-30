import { NextRequest, NextResponse } from "next/server";
import { COOKIE } from "./lib/jwt";

// Filtre rapide : sans cookie de session, retour à la connexion.
// La signature et le compte sont vérifiés côté serveur sur chaque page et chaque API (lib/auth.ts).
export function middleware(req: NextRequest) {
  if (req.cookies.get(COOKIE)?.value) return NextResponse.next();
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
