import { NextResponse } from "next/server";
import { utilisateurCourant } from "@/lib/auth";
import { q } from "@/lib/db";

/** Liste des mots clés pour l'autocomplétion (tout utilisateur connecté), du plus utilisé au moins utilisé. */
export async function GET() {
  const u = await utilisateurCourant();
  if (!u) return NextResponse.json({ erreur: "Session expirée" }, { status: 401 });
  const mots = await q<{ id: number; texte: string; usage: number }>(
    "SELECT id, texte, usage FROM mots_cles ORDER BY usage DESC, texte"
  );
  return NextResponse.json(mots, { headers: { "Cache-Control": "no-store" } });
}
