import { NextResponse } from "next/server";
import { estJure, utilisateurCourant } from "@/lib/auth";
import { q, q1 } from "@/lib/db";

/**
 * Enregistre le classement commun.
 * Le client envoie l'ordre complet et la version qu'il avait sous les yeux :
 * si un autre juge a reclassé entre-temps, on refuse (409) pour ne pas écraser son classement.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await utilisateurCourant();
  if (!u) return NextResponse.json({ erreur: "Session expirée" }, { status: 401 });
  const id = Number((await params).id);
  if (!(await estJure(u, id))) {
    return NextResponse.json({ erreur: "Seuls les membres du jury peuvent classer." }, { status: 403 });
  }

  const corps = await req.json().catch(() => null);
  const ordre: number[] = Array.isArray(corps?.ordre) ? corps.ordre.map(Number).filter(Number.isFinite) : [];
  const version = Number(corps?.version);
  if (!Number.isFinite(version)) return NextResponse.json({ erreur: "Requête invalide" }, { status: 400 });

  // L'ordre doit contenir exactement les poneys de l'épreuve
  const ids = (await q<{ id: number }>("SELECT id FROM poneys WHERE epreuve_id = $1", [id])).map((r) => r.id);
  const attendu = new Set(ids);
  if (ordre.length !== ids.length || new Set(ordre).size !== ordre.length || !ordre.every((x) => attendu.has(x))) {
    return NextResponse.json({ erreur: "La liste des poneys a changé, rechargement…" }, { status: 409 });
  }

  // Une seule requête : la version n'avance (et les rangs ne changent) que si elle n'a pas bougé.
  const r = await q1<{ rang_version: number }>(
    `WITH v AS (
        UPDATE epreuves SET rang_version = rang_version + 1, rang_par = $3, rang_le = now()
         WHERE id = $1 AND rang_version = $4
     RETURNING rang_version
     ), maj AS (
        UPDATE poneys p SET rang = x.r
          FROM unnest($2::int[]) WITH ORDINALITY AS x(id, r), v
         WHERE p.id = x.id AND p.epreuve_id = $1
     )
     SELECT rang_version FROM v`,
    [id, ordre, u.id, version]
  );
  if (!r) {
    return NextResponse.json({ erreur: "Un autre juge vient de modifier le classement." }, { status: 409 });
  }
  return NextResponse.json({ version: r.rang_version });
}
