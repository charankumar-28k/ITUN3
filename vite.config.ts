import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isVercel = !!process.env.VERCEL || process.env.DISABLE_CLOUDFLARE === "1";

export default defineConfig({
  // Disable the Cloudflare Workers adapter when deploying to Vercel
  cloudflare: isVercel ? false : undefined,
  vite: {
    build: {
      outDir: "dist/client",
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      proxy: {
        "/proxy/saavn1": {
          target: "https://jiosaavn-api-privatecvc2.vercel.app",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/proxy\/saavn1/, "/api"),
          secure: false,
        },
        "/proxy/saavn2": {
          target: "https://saavn-api-ts.vercel.app",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/proxy\/saavn2/, "/api"),
          secure: false,
        },
        "/proxy/saavn3": {
          target: "https://jiosaavn-api-sigma.vercel.app",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/proxy\/saavn3/, "/api"),
          secure: false,
        },
      },
    },
  },
});
