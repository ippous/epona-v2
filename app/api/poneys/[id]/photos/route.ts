import { NextResponse } from "next/server";
import { peutJuger, utilisateurCourant } from "@/lib/auth";
import { q1 } from "@/lib/db";

const MAX_IMAGE = 3 * 1024 * 1024;   // l'image est déjà réduite sur le téléphone (~300 Ko)
const MAX_MINIATURE = 300 * 1024;

/** Le fichier doit être un vrai JPEG (le téléphone réencode toujours en JPEG avant l'envoi). */
function estJpeg(b: Uint8Array) {
  return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
}

/** Ajoute une photo à un poney : membres du jury et administrateurs. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await utilisateurCourant();
  if (!u) return NextResponse.json({ erreur: "Session expirée" }, { status: 401 });
  const poneyId = Number((await params).id);
  const p = await q1<{ epreuve_id: number }>("SELECT epreuve_id FROM poneys WHERE id = $1", [poneyId]);
  if (!p || !(await peutJuger(u, p.epreuve_id))) {
    return NextResponse.json({ erreur: "Poney introuvable" }, { status: 404 });
  }

  const fd = await req.formData().catch(() => null);
  const image = fd?.get("image");
  const mini = fd?.get("miniature");
  if (!(image instanceof Blob) || !(mini instanceof Blob)) {
    return NextResponse.json({ erreur: "Photo manquante" }, { status: 400 });
  }
  if (image.size > MAX_IMAGE || mini.size > MAX_MINIATURE) {
    return NextResponse.json({ erreur: "Photo trop lourde" }, { status: 413 });
  }
  const bImage = new Uint8Array(await image.arrayBuffer());
  const bMini = new Uint8Array(await mini.arrayBuffer());
  if (!estJpeg(bImage) || !estJpeg(bMini)) {
    return NextResponse.json({ erreur: "Format d'image non accepté" }, { status: 415 });
  }
  const dim = (k: string) => Math.max(0, Math.min(10000, parseInt(String(fd!.get(k) ?? "0"), 10) || 0));

  const r = await q1<{ id: number }>(
    `INSERT INTO photos (poney_id, user_id, largeur, hauteur, image, miniature)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [poneyId, u.id, dim("largeur"), dim("hauteur"),
     Buffer.from(bImage).toString("base64"), Buffer.from(bMini).toString("base64")]
  );
  return NextResponse.json({
    photo: { id: r!.id, userId: u.id, auteur: u.nom || u.login, largeur: dim("largeur"), hauteur: dim("hauteur") },
  });
}
