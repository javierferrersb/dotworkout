import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/",
  plugins: [
    svelte(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "favicon-96.png", "apple-touch-icon.png"],
      manifest: {
        name: "Dot Workout",
        short_name: "Dot Workout",
        description:
          "Online creator for Apple .workout files. Build custom Apple Watch workouts with intervals, repetitions and heart-rate zones.",
        theme_color: "#101013",
        background_color: "#101013",
        display: "standalone",
        orientation: "any",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "favicon-96.png", sizes: "96x96", type: "image/png" },
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
    }),
  ],
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
