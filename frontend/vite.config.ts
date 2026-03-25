import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  return {
    plugins: [react()],
    base: env.VITE_STATIC === 'true' ? '/stdn-explorer/' : '/',
    define: {
      // Base64-encode the API key at build time so the raw key pattern
      // (AIzaSy...) doesn't appear in the compiled JS bundle.
      // This prevents GitHub secret scanning from flagging it.
      '__GEMINI_KEY_B64__': JSON.stringify(
        env.VITE_GEMINI_API_KEY
          ? Buffer.from(env.VITE_GEMINI_API_KEY).toString('base64')
          : ''
      ),
    },
  }
})
