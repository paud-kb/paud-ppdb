import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  server: {
    open: true
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        ppdb: resolve(root, 'ppdb.html'),
        registrasi: resolve(root, 'registrasi.html'),
        'admin-login': resolve(root, 'admin/login.html'),
        'admin-dashboard': resolve(root, 'admin/dashboard.html'),
        'admin-super': resolve(root, 'admin/super-admin.html'),
      }
    }
  }
});