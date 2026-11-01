import { NextResponse } from "next/server";
import { utilisateurCourant } from "@/lib/auth";
import { rechercher } from "@/lib/equides";

/** Recherche d'un équidé : ?q=…&mode=nom (notre base + API Équidés) ou mode=sire (notre base). */
export async function GET(req: Request) {
  const u = await utilisateurCourant();
  if (!u || u.role !== "ADMIN") return NextResponse.json({ erreur: "Accès refusé" }, { status: 401 });
  const url = new URL(req.url);
  const texte = (url.searchParams.get("q") ?? "").slice(0, 80);
  const mode = url.searchParams.get("mode") === "sire" ? "sire" : "nom";
  return NextResponse.json(await rechercher(texte, mode), { headers: { "Cache-Control": "no-store" } });
}
