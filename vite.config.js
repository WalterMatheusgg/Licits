import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Bind inside Codespaces and allow ONLY this codespace's forwarded app hostname.
// Do not use allowedHosts: true; it permits DNS-rebinding access to dev files.
const codespaceName = process.env.CODESPACE_NAME;
const codespaceHost = codespaceName ? `${codespaceName}-5173.app.github.dev` : null;

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: codespaceHost ? [codespaceHost] : [],
  },
});
