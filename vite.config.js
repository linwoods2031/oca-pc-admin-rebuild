import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
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
