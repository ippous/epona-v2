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
  } else if (process.env.VERCEL) {
    throw new Error("Base de données non reliée : créez une base Neon dans l'onglet Storage du projet Vercel (DATABASE_URL), puis redéployez.");
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

  // Premier administrateur depuis l'environnement (facultatif). Sinon, en production,
  // la page de connexion propose de créer le premier compte administrateur.
  const [{ n }] = await run("SELECT count(*)::int AS n FROM utilisateurs WHERE role = 'ADMIN'");
  const pwd = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV !== "production" ? "admin" : "");
  if (n === 0 && pwd) {
    const login = process.env.ADMIN_LOGIN || "admin";
    await run(
      "INSERT INTO utilisateurs (login, nom, mot_de_passe, role) VALUES ($1, $2, $3, 'ADMIN') ON CONFLICT (login) DO NOTHING",
      [login, "Administrateur", await bcrypt.hash(pwd, 10)]
    );
  }

  // Secret de signature des sessions : SESSION_SECRET s'il est défini, sinon généré une fois et gardé en base.
  if (!process.env.SESSION_SECRET) {
    const { randomBytes } = await import("node:crypto");
    await run(
      "INSERT INTO parametres (cle, valeur) VALUES ('session_secret', $1) ON CONFLICT (cle) DO NOTHING",
      [randomBytes(48).toString("base64")]
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

let secretCache: string | undefined;
export async function secretSession(): Promise<string> {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (!secretCache) {
    secretCache = (await q1<{ valeur: string }>("SELECT valeur FROM parametres WHERE cle = 'session_secret'"))!.valeur;
  }
  return secretCache;
}

export async function existeAdmin(): Promise<boolean> {
  return !!(await q1("SELECT 1 FROM utilisateurs WHERE role = 'ADMIN' LIMIT 1"));
}

export const NIVEAUX_DEFAUT =["Sans Qualification", "A Revoir", "Excellent", "Très Excellent"];

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
