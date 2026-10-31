import { NextResponse } from "next/server";
import { peutJuger, utilisateurCourant } from "@/lib/auth";
import { q, q1 } from "@/lib/db";

async function photoAccessible(id: number) {
  const u = await utilisateurCourant();
  if (!u) return { u: null, ph: null, statut: 401 } as const;
  const ph = await q1<{ epreuve_id: number; user_id: number | null }>(
    "SELECT p.epreuve_id, ph.user_id FROM photos ph JOIN poneys p ON p.id = ph.poney_id WHERE ph.id = $1", [id]
  );
  if (!ph || !(await peutJuger(u, ph.epreuve_id))) return { u, ph: null, statut: 404 } as const;
  return { u, ph, statut: 200 } as const;
}

/** Image d'une photo : ?t=mini pour la vignette, sinon l'image complète. Réservé aux personnes ayant accès à l'épreuve. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { statut } = await photoAccessible(id);
  if (statut !== 200) return new Response(null, { status: statut });

  const mini = new URL(req.url).searchParams.get("t") === "mini";
  const r = await q1<{ data: string }>(`SELECT ${mini ? "miniature" : "image"} AS data FROM photos WHERE id = $1`, [id]);
  if (!r) return new Response(null, { status: 404 });
  return new Response(Buffer.from(r.data, "base64"), {
    headers: {
      "Content-Type": "image/jpeg",
      // Une photo ne change jamais (nouvel identifiant à chaque ajout) : cache privé du navigateur, longue durée
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Disposition": `inline; filename="photo-${id}.jpg"`,
    },
  });
}

/** Suppression : l'auteur de la photo ou un administrateur. */
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { u, ph, statut } = await photoAccessible(id);
  if (statut !== 200 || !u || !ph) return NextResponse.json({ erreur: "Photo introuvable" }, { status: statut });
  if (u.role !== "ADMIN" && ph.user_id !== u.id) {
    return NextResponse.json({ erreur: "Seul l'auteur de la photo ou un administrateur peut la supprimer." }, { status: 403 });
  }
  await q("DELETE FROM photos WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
