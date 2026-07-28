import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  },
  // These packages ship as CommonJS and are consumed with interop-sensitive
  // imports (including a namespace import in HomePage.jsx). Pre-bundle them
  // explicitly so Vite's dep optimizer resolves them consistently on cold and
  // warm caches — otherwise a stale cache can serve a broken module and blank
  // the whole page.
  optimizeDeps: {
    include: ['react-countup', 'react-fast-marquee', 'react-simple-typewriter'],
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
          if (id.includes('react-router')) return 'router';
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-vendor';
        }
      }
    }
  }
})
