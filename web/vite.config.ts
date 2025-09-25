import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// Proxy API calls to FastAPI server during dev
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
