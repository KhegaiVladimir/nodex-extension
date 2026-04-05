import { defineConfig, build as viteBuild } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { cpSync, copyFileSync, mkdirSync, existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dist = resolve(__dirname, 'dist')

/**
 * Builds content/index.js as a single IIFE file (no chunks).
 * Runs after the main sidepanel build completes.
 */
function buildContentScript() {
  let ran = false
  return {
    name: 'build-content-script',
    async closeBundle() {
      if (ran) return
      ran = true

      await viteBuild({
        configFile: false,
        build: {
          emptyOutDir: false,
          outDir: dist,
          rollupOptions: {
            input: {
              'content/index': resolve(__dirname, 'content/index.js'),
            },
            output: {
              format: 'iife',
              entryFileNames: '[name].js',
              inlineDynamicImports: true,
            },
            external: [/^@mediapipe\//],
          },
          minify: true,
        },
      })
    },
  }
}

/**
 * Copies static files that Vite does not process:
 * manifest.json, assets/mediapipe/*, background/service-worker.js
 */
function copyStaticFiles() {
  return {
    name: 'copy-static-files',
    closeBundle() {
      if (existsSync(resolve(__dirname, 'manifest.json'))) {
        copyFileSync(
          resolve(__dirname, 'manifest.json'),
          resolve(dist, 'manifest.json'),
        )
      }

      if (existsSync(resolve(__dirname, 'assets'))) {
        cpSync(
          resolve(__dirname, 'assets'),
          resolve(dist, 'assets'),
          { recursive: true },
        )
      }

      const bgSrc = resolve(__dirname, 'background/service-worker.js')
      if (existsSync(bgSrc)) {
        mkdirSync(resolve(dist, 'background'), { recursive: true })
        copyFileSync(bgSrc, resolve(dist, 'background/service-worker.js'))
      }

      const bridgeSrc = resolve(__dirname, 'content/mediapipe-bridge.js')
      if (existsSync(bridgeSrc)) {
        mkdirSync(resolve(dist, 'content'), { recursive: true })
        copyFileSync(bridgeSrc, resolve(dist, 'content/mediapipe-bridge.js'))
      }
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    buildContentScript(),
    copyStaticFiles(),
  ],

  build: {
    outDir: dist,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'sidepanel/index.html'),
      },
      external: [/^@mediapipe\//],
    },
  },
})
