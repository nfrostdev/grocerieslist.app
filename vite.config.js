import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'robots.txt', 'img/icons/*'],
      manifest: {
        name: 'Groceries List',
        short_name: 'Groceries List',
        theme_color: '#111827',
        background_color: '#111827',
        icons: [
          { src: '/img/icons/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/img/icons/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/img/icons/android-chrome-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'shared')
    }
  },
  test: {
    include: ['tests/unit/**/*.spec.{js,ts}'],
    setupFiles: ['tests/unit/setup.ts'],
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**', 'shared/**'],
      exclude: ['src/main.ts', 'src/router/**', 'src/**/*.d.ts', 'src/assets/**', 'src/sync/types.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      }
    }
  }
})
