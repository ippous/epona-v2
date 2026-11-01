import { NextResponse } from "next/server";
import { utilisateurCourant } from "@/lib/auth";
import { q1 } from "@/lib/db";

/** Un juge a choisi ce mot clé dans les suggestions : sa fréquence d'usage augmente de 1. */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await utilisateurCourant();
  if (!u) return NextResponse.json({ erreur: "Session expirée" }, { status: 401 });
  const id = Number((await params).id);
  const r = await q1<{ usage: number }>("UPDATE mots_cles SET usage = usage + 1 WHERE id = $1 RETURNING usage", [id]);
  if (!r) return NextResponse.json({ erreur: "Mot clé introuvable" }, { status: 404 });
  return NextResponse.json({ usage: r.usage });
}
