import "server-only";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { COOKIE, DUREE_SESSION_S, signer, verifier } from "./jwt";
import { q1 } from "./db";

export type Utilisateur = { id: number; login: string; nom: string; role: "ADMIN" | "JUGE" };

export async function ouvrirSession(u: { id: number; role: "ADMIN" | "JUGE" }) {
  const jar = await cookies();
  jar.set(COOKIE, await signer({ uid: u.id, role: u.role }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DUREE_SESSION_S,
  });
}

export async function fermerSession() {
  (await cookies()).delete(COOKIE);
}

/** Utilisateur connecté (relu en base : un compte désactivé perd l'accès immédiatement). */
export async function utilisateurCourant(): Promise<Utilisateur | null> {
  const jeton = await verifier((await cookies()).get(COOKIE)?.value);
  if (!jeton) return null;
  const u = await q1<Utilisateur & { actif: boolean }>(
    "SELECT id, login, nom, role, actif FROM utilisateurs WHERE id = $1",
    [jeton.uid]
  );
  if (!u || !u.actif) return null;
  return { id: u.id, login: u.login, nom: u.nom, role: u.role };
}

export async function exigerConnexion(): Promise<Utilisateur> {
  const u = await utilisateurCourant();
  if (!u) redirect("/login");
  return u;
}

export async function exigerAdmin(): Promise<Utilisateur> {
  const u = await exigerConnexion();
  if (u.role !== "ADMIN") notFound();
  return u;
}

/** Un juge n'accède qu'aux épreuves dont il fait partie du jury ; l'admin à toutes. */
export async function peutJuger(u: Utilisateur, epreuveId: number): Promise<boolean> {
  const e = await q1("SELECT 1 FROM epreuves WHERE id = $1", [epreuveId]);
  if (!e) return false;
  if (u.role === "ADMIN") return true;
  return !!(await q1("SELECT 1 FROM jury WHERE epreuve_id = $1 AND user_id = $2", [epreuveId, u.id]));
}

export async function estJure(u: Utilisateur, epreuveId: number): Promise<boolean> {
  return !!(await q1("SELECT 1 FROM jury WHERE epreuve_id = $1 AND user_id = $2", [epreuveId, u.id]));
}
