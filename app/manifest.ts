import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  const nom = process.env.NEXT_PUBLIC_APP_NAME || "Jury";
  return {
    name: nom,
    short_name: nom,
    start_url: "/",
    display: "standalone",
    background_color: "#f4f1ea",
    theme_color: "#23503d",
    lang: "fr",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
