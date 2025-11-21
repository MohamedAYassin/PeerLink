import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Enable source maps for debugging
    sourcemap: true,
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Manual chunk splitting for optimal loading
        manualChunks: {
          // Vendor chunks - separate large libraries
          'react-vendor': ['react', 'react-dom'],
          'socket-vendor': ['socket.io-client'],
          'ui-vendor': ['lucide-react'],
          // Compression utilities - loaded on demand
          'compression': ['fflate'],
        },
        // Optimize chunk file names
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        // Remove console logs in production
        drop_console: false,
        drop_debugger: true,
        pure_funcs: ['console.debug'],
      },
    },
    // Target modern browsers for smaller bundles
    target: 'es2020',
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'socket.io-client', 'lucide-react', 'fflate'],
  },
  // Performance improvements
  server: {
    // Enable HMR for faster development
    hmr: true,
  },
});
