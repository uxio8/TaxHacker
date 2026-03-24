import { createConfig } from "../lib/config.ts"
import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  const config = createConfig()

  return {
    id: "/capture",
    name: config.app.title,
    short_name: config.app.title,
    description: `Captura tickets y facturas desde el móvil y revisa tu inbox en ${config.app.title}.`,
    start_url: "/capture?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    shortcuts: [
      {
        name: "Captura",
        short_name: "Captura",
        description: "Abrir la captura móvil",
        url: "/capture",
        icons: [
          {
            src: "/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
      {
        name: "Inbox móvil",
        short_name: "Inbox",
        description: "Revisar la bandeja móvil",
        url: "/capture/inbox",
        icons: [
          {
            src: "/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
    ],
  }
}
