"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { q, q1, NIVEAUX_DEFAUT } from "@/lib/db";
import { exigerAdmin, fermerSession, ouvrirSession } from "@/lib/auth";

const txt = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const entier = (fd: FormData, k: string) => {
  const n = parseInt(txt(fd, k), 10);
  return Number.isFinite(n) ? n : null;
};
const HASH_LEURRE = bcrypt.hashSync("leurre-compte-inexistant", 10);
const dateOuNull =(s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

/* ---------------- Connexion ---------------- */

export async function connexion(_: { erreur?: string } | undefined, fd: FormData) {
  const login = txt(fd, "login");
  const mdp = String(fd.get("mot_de_passe") ?? "");
  const u = await q1<{ id: number; role: "ADMIN" | "JUGE"; mot_de_passe: string; actif: boolean }>(
    "SELECT id, role, mot_de_passe, actif FROM utilisateurs WHERE lower(login) = lower($1)",
    [login]
  );
  // Comparaison effectuée même si le compte n'existe pas : temps de réponse identique.
  const ok = await bcrypt.compare(mdp, u?.mot_de_passe ?? HASH_LEURRE);
  if (!u || !ok || !u.actif) {
    await new Promise((r) => setTimeout(r, 400));
    return { erreur: "Identifiant ou mot de passe incorrect." };
  }
  await ouvrirSession(u);
  redirect("/");
}

/** Première installation : crée le compte administrateur tant qu'aucun n'existe (atomique). */
export async function creerPremierAdmin(_: { erreur?: string } | undefined, fd: FormData) {
  const login = txt(fd, "login");
  const nom = txt(fd, "nom");
  const mdp = String(fd.get("mot_de_passe") ?? "");
  if (!/^[\w.\-@]{2,40}$/.test(login)) return { erreur: "Identifiant invalide (lettres, chiffres, . - _ @)." };
  if (mdp.length < 10) return { erreur: "Le mot de passe doit faire au moins 10 caractères." };
  if (mdp !== String(fd.get("confirmation") ?? "")) return { erreur: "Les deux mots de passe ne correspondent pas." };
  const u = await q1<{ id: number }>(
    `INSERT INTO utilisateurs (login, nom, mot_de_passe, role)
     SELECT $1, $2, $3, 'ADMIN' WHERE NOT EXISTS (SELECT 1 FROM utilisateurs WHERE role = 'ADMIN')
     ON CONFLICT (login) DO NOTHING RETURNING id`,
    [login, nom, await bcrypt.hash(mdp, 10)]
  );
  if (!u) return { erreur: "Un administrateur existe déjà : connectez-vous." };
  await ouvrirSession({ id: u.id, role: "ADMIN" });
  redirect("/");
}

export async function deconnexion() {
  await fermerSession();
  redirect("/login");
}

/* ---------------- Concours ---------------- */

export async function creerConcours(fd: FormData) {
  await exigerAdmin();
  const titre = txt(fd, "titre");
  if (!titre) return;
  const c = await q1<{ id: number }>(
    "INSERT INTO concours (titre, date_debut, date_fin, lieu) VALUES ($1, $2, $3, $4) RETURNING id",
    [titre, dateOuNull(txt(fd, "date_debut")), dateOuNull(txt(fd, "date_fin")), txt(fd, "lieu")]
  );
  redirect(`/concours/${c!.id}`);
}

export async function modifierConcours(fd: FormData) {
  await exigerAdmin();
  const id = entier(fd, "id");
  const titre = txt(fd, "titre");
  if (!id || !titre) return;
  await q("UPDATE concours SET titre = $2, date_debut = $3, date_fin = $4, lieu = $5 WHERE id = $1", [
    id, titre, dateOuNull(txt(fd, "date_debut")), dateOuNull(txt(fd, "date_fin")), txt(fd, "lieu"),
  ]);
  redirect(`/concours/${id}`);
}

export async function supprimerConcours(fd: FormData) {
  await exigerAdmin();
  const id = entier(fd, "id");
  if (id) await q("DELETE FROM concours WHERE id = $1", [id]);
  redirect("/");
}

/* ---------------- Épreuves ---------------- */

function lireNiveaux(fd: FormData): string[] {
  const l = txt(fd, "niveaux").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  return l.length ? Array.from(new Set(l)) : NIVEAUX_DEFAUT;
}

export async function creerEpreuve(fd: FormData) {
  await exigerAdmin();
  const concoursId = entier(fd, "concours_id");
  const titre = txt(fd, "titre");
  if (!concoursId || !titre) return;
  const e = await q1<{ id: number }>(
    `INSERT INTO epreuves (concours_id, titre, niveaux, ordre)
     VALUES ($1, $2, $3::jsonb, (SELECT coalesce(max(ordre), 0) + 1 FROM epreuves WHERE concours_id = $1))
     RETURNING id`,
    [concoursId, titre, JSON.stringify(lireNiveaux(fd))]
  );
  redirect(`/admin/epreuves/${e!.id}`);
}

export async function modifierEpreuve(fd: FormData) {
  await exigerAdmin();
  const id = entier(fd, "id");
  const titre = txt(fd, "titre");
  if (!id || !titre) return;
  await q("UPDATE epreuves SET titre = $2, niveaux = $3::jsonb WHERE id = $1", [
    id, titre, JSON.stringify(lireNiveaux(fd)),
  ]);
  revalidatePath(`/admin/epreuves/${id}`);
  redirect(`/admin/epreuves/${id}?ok=epreuve`);
}

export async function supprimerEpreuve(fd: FormData) {
  await exigerAdmin();
  const id = entier(fd, "id");
  const e = await q1<{ concours_id: number }>("DELETE FROM epreuves WHERE id = $1 RETURNING concours_id", [id]);
  redirect(e ? `/concours/${e.concours_id}` : "/");
}

export async function enregistrerJury(fd: FormData) {
  await exigerAdmin();
  const id = entier(fd, "id");
  if (!id) return;
  const juges = fd.getAll("juges").map((v) => parseInt(String(v), 10)).filter(Number.isFinite);
  await q("DELETE FROM jury WHERE epreuve_id = $1 AND NOT (user_id = ANY($2::int[]))", [id, juges]);
  if (juges.length) {
    await q(
      "INSERT INTO jury (epreuve_id, user_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING",
      [id, juges]
    );
  }
  revalidatePath(`/admin/epreuves/${id}`);
  redirect(`/admin/epreuves/${id}?ok=jury`);
}

/* ---------------- Poneys ---------------- */

export async function ajouterPoney(fd: FormData) {
  await exigerAdmin();
  const epreuveId = entier(fd, "epreuve_id");
  const nom = txt(fd, "nom");
  if (!epreuveId || !nom) return;
  await q(
    `INSERT INTO poneys (epreuve_id, numero, nom, sire, proprietaire, rang)
     VALUES ($1, $2, $3, $4, $5, (SELECT coalesce(max(rang), 0) + 1 FROM poneys WHERE epreuve_id = $1))`,
    [epreuveId, entier(fd, "numero"), nom, txt(fd, "sire").toUpperCase(), txt(fd, "proprietaire")]
  );
  revalidatePath(`/admin/epreuves/${epreuveId}`);
  redirect(`/admin/epreuves/${epreuveId}#poneys`);
}

/** Collage d'une liste : une ligne par poney, « n° ; nom ; SIRE ; propriétaire » (séparateur ; , ou tabulation). */
export async function importerPoneys(fd: FormData) {
  await exigerAdmin();
  const epreuveId = entier(fd, "epreuve_id");
  if (!epreuveId) return;
  const lignes = txt(fd, "liste").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const l of lignes) {
    const c = l.split(/\t|;/).map((s) => s.trim());
    let [numero, nom, sire, prop] = c.length >= 2 ? c : ["", c[0], "", ""];
    let num: number | null = parseInt(numero, 10);
    if (!Number.isFinite(num)) {
      // Pas de numéro en tête : la ligne commence directement par le nom
      [nom, sire, prop] = c;
      num = null;
    }
    if (!nom) continue;
    await q(
      `INSERT INTO poneys (epreuve_id, numero, nom, sire, proprietaire, rang)
       VALUES ($1, $2, $3, $4, $5, (SELECT coalesce(max(rang), 0) + 1 FROM poneys WHERE epreuve_id = $1))`,
      [epreuveId, num, nom, (sire || "").toUpperCase(), prop || ""]
    );
  }
  revalidatePath(`/admin/epreuves/${epreuveId}`);
  redirect(`/admin/epreuves/${epreuveId}?ok=import#poneys`);
}

export async function modifierPoney(fd: FormData) {
  await exigerAdmin();
  const id = entier(fd, "id");
  const nom = txt(fd, "nom");
  if (!id || !nom) return;
  const p = await q1<{ epreuve_id: number }>(
    "UPDATE poneys SET numero = $2, nom = $3, sire = $4, proprietaire = $5 WHERE id = $1 RETURNING epreuve_id",
    [id, entier(fd, "numero"), nom, txt(fd, "sire").toUpperCase(), txt(fd, "proprietaire")]
  );
  if (p) redirect(`/admin/epreuves/${p.epreuve_id}#poneys`);
}

export async function supprimerPoney(fd: FormData) {
  await exigerAdmin();
  const id = entier(fd, "id");
  const p = await q1<{ epreuve_id: number }>("DELETE FROM poneys WHERE id = $1 RETURNING epreuve_id", [id]);
  if (p) redirect(`/admin/epreuves/${p.epreuve_id}#poneys`);
}

/* ---------------- Comptes ---------------- */

export async function creerUtilisateur(_: { erreur?: string; ok?: string } | undefined, fd: FormData) {
  await exigerAdmin();
  const login = txt(fd, "login");
  const nom = txt(fd, "nom");
  const mdp = String(fd.get("mot_de_passe") ?? "");
  const role = txt(fd, "role") === "ADMIN" ? "ADMIN" : "JUGE";
  if (!login || !/^[\w.\-@]{2,40}$/.test(login)) return { erreur: "Identifiant invalide (lettres, chiffres, . - _ @)." };
  if (mdp.length < 8) return { erreur: "Le mot de passe doit faire au moins 8 caractères." };
  if (await q1("SELECT 1 FROM utilisateurs WHERE lower(login) = lower($1)", [login])) {
    return { erreur: "Cet identifiant existe déjà." };
  }
  await q("INSERT INTO utilisateurs (login, nom, mot_de_passe, role) VALUES ($1, $2, $3, $4)", [
    login, nom, await bcrypt.hash(mdp, 10), role,
  ]);
  revalidatePath("/admin/utilisateurs");
  return { ok: `Compte « ${login} » créé.` };
}

export async function modifierUtilisateur(fd: FormData) {
  const moi = await exigerAdmin();
  const id = entier(fd, "id");
  if (!id) return;
  const role = txt(fd, "role") === "ADMIN" ? "ADMIN" : "JUGE";
  const actif = fd.get("actif") === "on";
  // On ne peut pas se retirer soi-même les droits ni se désactiver
  const estMoi = id === moi.id;
  await q("UPDATE utilisateurs SET nom = $2, role = $3, actif = $4 WHERE id = $1", [
    id, txt(fd, "nom"), estMoi ? "ADMIN" : role, estMoi ? true : actif,
  ]);
  const mdp = String(fd.get("mot_de_passe") ?? "");
  if (mdp.length >= 8) {
    await q("UPDATE utilisateurs SET mot_de_passe = $2 WHERE id = $1", [id, await bcrypt.hash(mdp, 10)]);
  }
  revalidatePath("/admin/utilisateurs");
  redirect(`/admin/utilisateurs?ok=${id}`);
}
