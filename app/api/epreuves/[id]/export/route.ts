import { peutJuger, utilisateurCourant } from "@/lib/auth";
import { chargerEpreuve } from "@/lib/epreuve";

/** Export CSV (séparateur « ; » et BOM UTF-8 : s'ouvre directement dans Excel français). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await utilisateurCourant();
  if (!u) return new Response("Session expirée", { status: 401 });
  const id = Number((await params).id);
  if (!(await peutJuger(u, id))) return new Response("Introuvable", { status: 404 });
  const v = (await chargerEpreuve(id, u.id))!;

  const cel = (x: unknown) => {
    let s = String(x ?? "");
    if (/^[=+\-@]/.test(s)) s = "'" + s; // neutralise les formules Excel
    return `"${s.replace(/"/g, '""')}"`;
  };
  const entete = ["Rang", "N°", "Nom", "SIRE", "Propriétaire", "Sexe", "Année", "Race", "Robe", "Origines", ...v.juges.flatMap((j) => [`Niveau ${j.nom}`, `Commentaire ${j.nom}`])];
  const lignes = v.poneys.map((p, i) => [
    i + 1, p.numero ?? "", p.nom, p.sire, p.proprietaire, p.sexe, p.annee ?? "", p.race, p.robe, p.origines,
    ...v.juges.flatMap((j) => {
      if (j.id === u.id) return [p.moi.niveau ?? "", p.moi.commentaire];
      const a = p.autres.find((x) => x.userId === j.id);
      return [a?.niveau ?? "", a?.commentaire ?? ""];
    }),
  ]);
  const csv = "﻿" + [entete, ...lignes].map((l) => l.map(cel).join(";")).join("\r\n");
  const nom = `resultats-${v.titre}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w-]+/g, "-").replace(/-+/g, "-").slice(0, 80);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nom}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
