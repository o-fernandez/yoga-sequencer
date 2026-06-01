import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Yoga Sequencer",
    short_name: "Yoga Seq",
    description: "Plan, save, and teach your yoga sequences",
    start_url: "/",
    display: "standalone",
    background_color: "#faf7f2",
    theme_color: "#2d1b0e",
    icons: [
      {
        src: "/icon",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
