import { defineConfig } from 'vite';

export default defineConfig({
  // Base path
  base: '/',
  
  // Public directory (untuk static files)
  publicDir: 'public',
  
  // Development server
  server: {
    port: 3000,
    open: true, // Auto open browser
    strictPort: false
  },
  
  // Build options
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './index.html',
        ppdb: './ppdb.html',
        registrasi: './registrasi.html',
        'admin-login': './admin/login.html',
        'admin-dashboard': './admin/dashboard.html',
        'admin-super': './admin/super-admin.html'
      }
    }
  }
});