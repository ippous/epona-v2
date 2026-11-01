import { NextResponse } from "next/server";
import { utilisateurCourant } from "@/lib/auth";
import { ficheApi } from "@/lib/equides";

/** Fiche complète d'un équidé de l'API Équidés (père, mère), au moment où il est choisi. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await utilisateurCourant();
  if (!u || u.role !== "ADMIN") return NextResponse.json({ erreur: "Accès refusé" }, { status: 401 });
  const fiche = await ficheApi((await params).id);
  if (!fiche) return NextResponse.json({ erreur: "Fiche indisponible" }, { status: 502 });
  return NextResponse.json(fiche);
}
