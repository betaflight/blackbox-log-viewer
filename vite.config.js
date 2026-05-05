import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import ui from "@nuxt/ui/vite";
import path from "node:path";
import { VitePWA } from "vite-plugin-pwa";
import pkg from "./package.json";

export default defineConfig({
  build: {
    sourcemap: true,
  },
  plugins: [
    vue(),
    ui({
      colorMode: false,
      ui: {
        button: {
          slots: {
            base: "font-semibold cursor-pointer",
          },
          defaultVariants: {
            size: "sm",
          },
          compoundVariants: [
            {
              color: "primary",
              variant: "solid",
              class: "text-black",
            },
          ],
        },
        tooltip: {
          slots: {
            content: "ring-2 ring-primary max-w-sm lg:max-w-lg h-fit",
            arrow: "fill-primary",
            text: "whitespace-normal",
          },
        },
        switch: {
          slots: {
            base: "cursor-pointer",
          },
          defaultVariants: {
            size: "sm",
          },
        },
        select: {
          slots: {
            base: "cursor-pointer",
            item: "cursor-pointer",
          },
          defaultVariants: {
            size: "sm",
          },
        },
        input: {
          defaultVariants: {
            size: "sm",
          },
        },
        modal: {
          slots: {
            overlay: "z-[200]",
            content: "z-[200]",
          },
        },
        colors: {
          primary: "primary",
          neutral: "neutral",
          success: "lime",
          warning: "orange",
        },
      },
    }),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,json,mcm,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      includeAssets: ["favicon.ico", "robots.txt", "apple-touch-icon.png"],
      manifest: {
        name: pkg.displayName,
        short_name: pkg.productName,
        description: pkg.description,
        theme_color: "#ffffff",
        icons: [
          {
            src: "/images/pwa/bf_icon_128.png",
            sizes: "128x128",
            type: "image/png",
          },
          {
            src: "/images/pwa/bf_icon_192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/images/pwa/bf_icon_256.png",
            sizes: "256x256",
            type: "image/png",
          },
        ],
        file_handlers: [
          {
            action: "/",
            accept: {
              "application/octet-stream": [".bbl", ".bfl"],
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      vue: path.resolve(
        __dirname,
        "node_modules/vue/dist/vue.esm-bundler.js",
      ),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
});
