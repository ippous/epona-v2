import type { Metadata, Viewport } from "next";
import "./globals.css";

const NOM = process.env.NEXT_PUBLIC_APP_NAME || "Jury";

export const metadata: Metadata = {
  title: { default: NOM, template: `%s · ${NOM}` },
  description: "Jugement de concours de poneys : niveaux, commentaires et classement.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: NOM, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#23503d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
