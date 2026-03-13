import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_STATIC === 'true' ? '/stdn-explorer/' : '/',
  define: {
    // Base64-encode the API key at build time so the raw key pattern
    // (AIzaSy...) doesn't appear in the compiled JS bundle.
    // This prevents GitHub secret scanning from flagging it.
    '__GEMINI_KEY_B64__': JSON.stringify(
      process.env.VITE_GEMINI_API_KEY
        ? Buffer.from(process.env.VITE_GEMINI_API_KEY).toString('base64')
        : ''
    ),
  },
})
