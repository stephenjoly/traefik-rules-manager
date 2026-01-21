import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import fs from 'fs/promises'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    {
      name: 'monaco-copy',
      apply: 'serve',
      async buildStart() {
        const src = path.resolve(__dirname, 'node_modules/monaco-editor/min/vs');
        const dest = path.resolve(__dirname, 'public/monaco/vs');
        await fs.rm(dest, { recursive: true, force: true }).catch(() => {});
        await fs.cp(src, dest, { recursive: true });
      },
    },
    {
      name: 'monaco-copy-build',
      apply: 'build',
      async buildStart() {
        const src = path.resolve(__dirname, 'node_modules/monaco-editor/min/vs');
        const dest = path.resolve(__dirname, 'public/monaco/vs');
        await fs.rm(dest, { recursive: true, force: true }).catch(() => {});
        await fs.cp(src, dest, { recursive: true });
      },
    },
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
})
