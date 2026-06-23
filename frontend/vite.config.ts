import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        // When the backend isn't running, respond with a clean 502 + hint
        // instead of flooding the terminal with ECONNREFUSED stack traces.
        configure: (proxy) => {
          let warned = false;
          proxy.on('error', (_err, _req, res: any) => {
            if (!warned) {
              console.warn('\n[proxy] Backend not reachable on http://localhost:4000 — start it: cd backend; npm run dev\n');
              warned = true;
            }
            if (res && typeof res.writeHead === 'function' && !res.headersSent) {
              res.writeHead(502, { 'content-type': 'application/json' });
              res.end(JSON.stringify({ error: 'backend_unavailable' }));
            }
          });
        },
      },
    },
  },
});
