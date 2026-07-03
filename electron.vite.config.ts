import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

const alias = {
  '@': resolve('src/renderer'),
  '@shared': resolve('src/renderer/shared'),
  '@domain': resolve('src/domain'),
  '@api': resolve('src/api'),
  '@data': resolve('src/data'),
  '@store': resolve('src/store'),
  '@ipc': resolve('electron/ipc'),
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias },
    build: {
      rollupOptions: { input: { index: resolve('electron/main.ts') } },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias },
    build: {
      rollupOptions: { input: { index: resolve('electron/preload.ts') } },
    },
  },
  renderer: {
    root: '.',
    resolve: { alias },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('index.html'),
          overlay: resolve('overlay.html'),
        },
      },
    },
  },
})
