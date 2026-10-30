import { NextResponse } from "next/server";
import { estJure, utilisateurCourant } from "@/lib/auth";
import { q, q1, niveauxDe } from "@/lib/db";

/** Enregistre le niveau et/ou le commentaire du juge connecté pour un poney. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await utilisateurCourant();
  if (!u) return NextResponse.json({ erreur: "Session expirée" }, { status: 401 });
  const poneyId = Number((await params).id);
  const p = await q1<{ epreuve_id: number; niveaux: unknown }>(
    "SELECT p.epreuve_id, e.niveaux FROM poneys p JOIN epreuves e ON e.id = p.epreuve_id WHERE p.id = $1", [poneyId]
  );
  if (!p) return NextResponse.json({ erreur: "Poney introuvable" }, { status: 404 });
  if (!(await estJure(u, p.epreuve_id))) {
    return NextResponse.json({ erreur: "Seuls les membres du jury peuvent juger." }, { status: 403 });
  }

  const corps = await req.json().catch(() => null);
  if (!corps || typeof corps !== "object") return NextResponse.json({ erreur: "Requête invalide" }, { status: 400 });
  const aNiveau = "niveau" in corps;
  const aCommentaire = "commentaire" in corps;
  if (!aNiveau && !aCommentaire) return NextResponse.json({ erreur: "Rien à enregistrer" }, { status: 400 });

  const niveau: string | null = aNiveau && corps.niveau != null ? String(corps.niveau) : null;
  if (niveau !== null && !niveauxDe(p.niveaux).includes(niveau)) {
    return NextResponse.json({ erreur: "Niveau inconnu pour cette épreuve" }, { status: 400 });
  }
  const commentaire = aCommentaire ? String(corps.commentaire ?? "").slice(0, 5000) : "";

  // $3 = niveau, $4 = commentaire ; seuls les champs envoyés sont mis à jour en cas de jugement existant.
  const majs = [aNiveau && "niveau = $3", aCommentaire && "commentaire = $4"].filter(Boolean).join(", ");
  await q(
    `INSERT INTO jugements (poney_id, user_id, niveau, commentaire) VALUES ($1, $2, $3, $4)
     ON CONFLICT (poney_id, user_id) DO UPDATE SET ${majs}, modifie_le = now()`,
    [poneyId, u.id, niveau, commentaire]
  );
  return NextResponse.json({ ok: true });
}
