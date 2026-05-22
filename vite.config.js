import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const appBase = process.env.VITE_APP_BASE || (process.env.NODE_ENV === 'production' ? '/pc-rebuild/' : '/');

export default defineConfig({
  base: appBase,
  plugins: [vue()],
  server: {
    port: 5177,
    proxy: {
      '/prod-api': {
        target: 'https://www.cgassessment.top',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
