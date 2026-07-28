import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const supabaseUrl = env.VITE_SUPABASE_URL || 'https://zhpwhoiigwwgpxvsubdb.supabase.co';

  return {
    server: {
      host: "::",
      port: 5173,
      allowedHosts: [
        "portal.lvh.me",
        "portal.localtest.me",
        "localhost",
        "as-macbook-pro.tailc513e0.ts.net",
        ".tailc513e0.ts.net"
      ],
      proxy: {
        '/api/auth/predefined-login': {
          target: `${supabaseUrl}/functions/v1/predefined-login`,
          changeOrigin: true,
          rewrite: () => '',
        }
      }
    },
    plugins: [react()],
  };
})
