import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        timeout: 30000,
        proxyTimeout: 30000,
        configure: (proxy) => {
          proxy.on('error', (err: Error & { code?: string }, req: IncomingMessage, res: ServerResponse | unknown) => {
            const reqUrl = req?.url || '';
            const method = req?.method || 'GET';
            const errorCode = err?.code || 'UNKNOWN';
            console.warn(`[Vite Proxy Error] ${method} ${reqUrl} -> http://127.0.0.1:5000 failed: [${errorCode}] ${err.message}. Ensure .NET backend is running.`);
            console.info(`[Vite Proxy Retry Guidance] Requests will automatically route once the .NET backend is online on http://127.0.0.1:5000.`);
            if (res && typeof res === 'object' && 'writeHead' in res && 'headersSent' in res) {
              const serverRes = res as ServerResponse;
              if (!serverRes.headersSent) {
                serverRes.writeHead(503, { 'Content-Type': 'application/json' });
                serverRes.end(JSON.stringify({
                  error: 'Backend API Offline / ECONNREFUSED',
                  code: errorCode,
                  message: 'ResQTrack .NET 10 backend on port 5000 is unreachable. Please launch the backend with ".\\start.ps1 -Dev" or "dotnet run".',
                  timestamp: new Date().toISOString()
                }));
              }
            }
          });
          proxy.on('proxyReq', (_proxyReq, _req) => {
            // Log outgoing proxied requests if in debug mode
          });
          proxy.on('proxyRes', (proxyRes, req: IncomingMessage) => {
            if (proxyRes.statusCode && proxyRes.statusCode >= 500) {
              console.warn(`[Vite Proxy Notice] Backend returned ${proxyRes.statusCode} for ${req?.method} ${req?.url}`);
            }
          });
        }
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 1200
  }
})
