import { SignJWT, jwtVerify } from "jose";

export const COOKIE = "jury_session";
export const DUREE_SESSION_S = 60 * 60 * 14; // une journée de concours

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET (32 caractères minimum) doit être défini.");
    }
    return new TextEncoder().encode("dev-secret-dev-secret-dev-secret-0000");
  }
  return new TextEncoder().encode(s);
}

export type Jeton = { uid: number; role: "ADMIN" | "JUGE" };

export async function signer(j: Jeton) {
  return new SignJWT({ role: j.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(j.uid))
    .setIssuedAt()
    .setExpirationTime(`${DUREE_SESSION_S}s`)
    .sign(secret());
}

export async function verifier(token: string | undefined): Promise<Jeton | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const uid = Number(payload.sub);
    if (!uid) return null;
    return { uid, role: payload.role === "ADMIN" ? "ADMIN" : "JUGE" };
  } catch {
    return null;
  }
}
