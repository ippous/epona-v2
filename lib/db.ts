import "server-only";
import bcrypt from "bcryptjs";
import { SCHEMA } from "./schema.mjs";

/**
 * Accès base de données.
 * - Production : Postgres Neon (DATABASE_URL), via le driver HTTP serverless.
 * - Local      : PGlite (Postgres embarqué en WASM) dans le dossier .pglite/, sans rien installer.
 * Le schéma est créé au premier appel (CREATE ... IF NOT EXISTS).
 */

type Row = Record<string, any>;
type Runner = (text: string, params?: unknown[]) => Promise<Row[]>;


declare global {
  // eslint-disable-next-line no-var
  var __juryDb: Promise<Runner> | undefined;
}

async function createRunner(): Promise<Runner> {
  const url = process.env.DATABASE_URL;
  let run: Runner;

  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    run = async (text, params = []) => (await sql.query(text, params as any[])) as Row[];
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite(process.env.PGLITE_DIR || "./.pglite");
    await pg.waitReady;
    run = async (text, params = []) => (await pg.query<Row>(text, params as any[])).rows;
  }

  // Création du schéma (instruction par instruction : le driver HTTP Neon n'accepte qu'une requête à la fois)
  for (const stmt of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) {
    await run(stmt);
  }

  // Premier administrateur (créé tant qu'aucun compte admin n'existe)
  const [{ n }] = await run("SELECT count(*)::int AS n FROM utilisateurs WHERE role = 'ADMIN'");
  if (n === 0) {
    const login = process.env.ADMIN_LOGIN || "admin";
    const pwd = process.env.ADMIN_PASSWORD;
    if (!pwd && process.env.NODE_ENV === "production") {
      throw new Error("ADMIN_PASSWORD doit être défini pour créer le premier administrateur.");
    }
    await run(
      "INSERT INTO utilisateurs (login, nom, mot_de_passe, role) VALUES ($1, $2, $3, 'ADMIN') ON CONFLICT (login) DO NOTHING",
      [login, "Administrateur", await bcrypt.hash(pwd || "admin", 10)]
    );
  }
  return run;
}

function runner(): Promise<Runner> {
  if (!globalThis.__juryDb) {
    globalThis.__juryDb = createRunner().catch((e) => {
      globalThis.__juryDb = undefined;
      throw e;
    });
  }
  return globalThis.__juryDb;
}

export async function q<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const run = await runner();
  return (await run(text, params)) as T[];
}

export async function q1<T = Row>(text: string, params: unknown[] = []): Promise<T | undefined> {
  return (await q<T>(text, params))[0];
}

export const NIVEAUX_DEFAUT = ["Sans Qualification", "A Revoir", "Excellent", "Très Excellent"];

/** Les niveaux reviennent en tableau (Neon/PGlite décodent le JSONB) ; on sécurise le cas texte. */
export function niveauxDe(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      if (Array.isArray(p)) return p.map(String);
    } catch {}
  }
  return NIVEAUX_DEFAUT;
}
