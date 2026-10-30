import { NextResponse } from "next/server";
import { peutJuger, utilisateurCourant, estJure } from "@/lib/auth";
import { chargerEpreuve } from "@/lib/epreuve";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await utilisateurCourant();
  if (!u) return NextResponse.json({ erreur: "Session expirée" }, { status: 401 });
  const id = Number((await params).id);
  if (!(await peutJuger(u, id))) return NextResponse.json({ erreur: "Accès refusé" }, { status: 404 });
  const vue = await chargerEpreuve(id, u.id);
  return NextResponse.json({ ...vue, estJure: await estJure(u, id) }, { headers: { "Cache-Control": "no-store" } });
}
