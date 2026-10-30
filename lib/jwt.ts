import { SignJWT, jwtVerify } from "jose";

export const COOKIE = "jury_session";
export const DUREE_SESSION_S = 60 * 60 * 14; // une journée de concours

export type Jeton = { uid: number; role: "ADMIN" | "JUGE" };

const cle = (secret: string) => new TextEncoder().encode(secret);

export async function signer(j: Jeton, secret: string) {
  return new SignJWT({ role: j.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(j.uid))
    .setIssuedAt()
    .setExpirationTime(`${DUREE_SESSION_S}s`)
    .sign(cle(secret));
}

export async function verifier(token: string | undefined, secret: string): Promise<Jeton | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, cle(secret), { algorithms: ["HS256"] });
    const uid = Number(payload.sub);
    if (!uid) return null;
    return { uid, role: payload.role === "ADMIN" ? "ADMIN" : "JUGE" };
  } catch {
    return null;
  }
}
