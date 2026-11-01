import { utilisateurCourant } from "@/lib/auth";
import { q } from "@/lib/db";

/** Export CSV des mots clés et de leur fréquence (réimportable tel quel). */
export async function GET() {
  const u = await utilisateurCourant();
  if (!u || u.role !== "ADMIN") return new Response("Accès refusé", { status: 404 });
  const mots = await q<{ texte: string; usage: number }>("SELECT texte, usage FROM mots_cles ORDER BY usage DESC, texte");
  const cel = (s: string) => {
    const v = /^[=+\-@]/.test(s) ? "'" + s : s;
    return `"${v.replace(/"/g, '""')}"`;
  };
  const csv = "﻿" + ["Mot clé;Fréquence", ...mots.map((m) => `${cel(m.texte)};${m.usage}`)].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="mots-cles.csv"',
      "Cache-Control": "no-store",
    },
  });
}
