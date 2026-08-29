import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'dashboard-admin.html'),
        police: resolve(__dirname, 'dashboard-police.html'),
        driver: resolve(__dirname, 'dashboard-driver.html'),
        patrol: resolve(__dirname, 'dashboard-patrol.html'),
      },
    },
  },
});
