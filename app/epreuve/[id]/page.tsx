import { notFound } from "next/navigation";
import { estJure, exigerConnexion, peutJuger } from "@/lib/auth";
import { chargerEpreuve } from "@/lib/epreuve";
import Barre from "@/components/Barre";
import Jugement from "./Jugement";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: `Épreuve ${(await params).id}` };
}

export default async function PageEpreuve({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigerConnexion();
  const id = Number((await params).id);
  if (!(await peutJuger(u, id))) notFound();
  const vue = await chargerEpreuve(id, u.id);
  if (!vue) notFound();
  return (
    <>
      <Barre u={u} />
      <Jugement initial={vue} estJure={await estJure(u, id)} estAdmin={u.role === "ADMIN"} moiId={u.id} />
    </>
  );
}
