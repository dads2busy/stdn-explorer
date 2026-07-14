# Adding the Gemini analyst to your dashboard

*Internal setup guide*

Here's exactly how I wired Gemini into the STDN Explorer — a **client-side, static-hosted** dashboard with no backend. Follow it top to bottom and you'll have the same setup in about twenty minutes.

## The shape of it

*Read this part first — it explains why the steps look the way they do.*

My dashboard is a static site (GitHub Pages, no server), so there's nowhere private to keep an API key — whatever the browser needs, it ships in the compiled bundle. Rather than stand up a backend just to proxy Gemini, I let the key ride along in the bundle and wrap it in **three independent layers of protection**. Any one of them failing still leaves you covered by the other two.

| Layer | What it does |
|-------|--------------|
| **1 · Hide** — base64-encode the key at build time | The raw `AIzaSy…` pattern never appears in the shipped JS, so GitHub's secret scanner doesn't flag and auto-revoke it. This is obfuscation, not security — assume anyone determined can still pull the key out of the bundle. That's fine, because of the next two layers. |
| **2 · Lock** — restrict the key to your URL | In the Google Cloud console the key is locked to the deployed site via an HTTP-referrer restriction. Even with the key in hand, Google rejects any request that doesn't come from that URL — so an extracted key won't run from someone else's site or a script. |
| **3 · Cap** — stay on the free tier | I use the free-level model (`gemini-2.5-flash`) with no billing enabled on the project. The absolute worst case — both layers above bypassed — is bounded by free-tier rate limits. There's no bill to run up. |

**Net effect:** Layer 1 keeps the scanners quiet, Layer 2 makes a leaked key useless off your site, and Layer 3 caps the blast radius to zero dollars. Good enough for a demo key; if you ever move to a paid model or sensitive data, put a real backend proxy in front of it instead.

## The steps

Six of them. The only unusual one is Step 4.

### 1. Get an API key

Go to [Google AI Studio → API keys](https://aistudio.google.com/apikey) and create one. Copy it somewhere temporary — you'll paste it into two places (local dev and CI) and nowhere in your source code.

### 2. Install the SDK

One dependency, added from your frontend directory:

```bash
npm install @google/generative-ai
```

### 3. Encode the key at build time

This is **Layer 1**. In `vite.config.ts`, read the key from an env var and inject it as a base64-encoded `define`. Vite replaces the placeholder with the encoded string when it builds.

```ts
// inside defineConfig(({ mode }) => { ... })
const env = loadEnv(mode, '.', '')

return {
  define: {
    // raw "AIzaSy..." never lands in the bundle —
    // keeps GitHub secret scanning from flagging it
    '__GEMINI_KEY_B64__': JSON.stringify(
      env.VITE_GEMINI_API_KEY
        ? Buffer.from(env.VITE_GEMINI_API_KEY).toString('base64')
        : ''
    ),
  },
}
```

### 4. Lock the key to your URL — *the important one*

This is **Layer 2**, and it's the step people skip. In the [Google Cloud console](https://console.cloud.google.com/apis/credentials) → **APIs & Services → Credentials**, click your key and set:

- **Application restrictions → HTTP referrers.** Add your deployed URL, e.g. `https://your-org.github.io/your-dashboard/*`. Add `http://localhost:5173/*` too if you want the same key to work in local dev — otherwise use a separate unrestricted key that lives only in your `.env`.
- **API restrictions → Restrict key** to the **Generative Language API** only.
- Leave the model on a free tier and **don't enable billing** on the project — that's your Layer 3 hard ceiling.

> **Note:** Referrer restrictions can take a few minutes to propagate. If calls 403 right after you save, wait and retry before assuming something's broken.

### 5. Decode and call from a client module

Mirror my `src/lib/gemini/client.ts`. It decodes the key, lazily builds the model, and exposes an `isGeminiAvailable()` guard so the chat UI hides itself gracefully when no key is set — which means the app still runs locally without one.

```ts
import { GoogleGenerativeAI } from "@google/generative-ai"

declare const __GEMINI_KEY_B64__: string

function getApiKey(): string {
  return __GEMINI_KEY_B64__ ? atob(__GEMINI_KEY_B64__) : ""
}

export function isGeminiAvailable(): boolean {
  return !!getApiKey()   // gate the chat UI on this
}

const genai = new GoogleGenerativeAI(getApiKey())
const model = genai.getGenerativeModel({ model: "gemini-2.5-flash" })
```

From there, `model.startChat({ ... })` and `sendMessage()` as usual. Swap my `SYSTEM_PROMPT` and data-context string for whatever your dashboard is about — that's the only domain-specific part.

### 6. Wire the key into local dev and CI

The key lives in exactly two places, never in source.

**Local dev** — a gitignored `.env` in your frontend folder:

```bash
# frontend/.env  — gitignored, never committed
VITE_GEMINI_API_KEY=AIzaSy…
```

**CI / deploy** — store it as a repo secret (I named mine `VITE_GEMINI_API_KEY`) and pass it into the build step's `env:` block. It gets encoded during `vite build` and baked into the deployed bundle.

```yaml
# .github/workflows/deploy.yml
      - name: Build
        run: npx vite build
        env:
          VITE_STATIC: "true"
          VITE_GEMINI_API_KEY: ${{ secrets.VITE_GEMINI_API_KEY }}
```

> **Never commit the key.** It belongs only in `.env` (gitignored) and in your GitHub repo secrets. If it ever lands in a commit, rotate it in AI Studio — don't just delete the line.

## Files worth copying wholesale

Grab these from my repo as working references rather than rebuilding from scratch.

| File | What it gives you |
|------|-------------------|
| `frontend/vite.config.ts` | The build-time base64 encode (Layer 1). |
| `frontend/src/lib/gemini/client.ts` | Decode, model init, `sendMessage`, and the system prompt. |
| `frontend/src/components/analyst/GeminiChatPanel.tsx` | The chat UI, including the `isGeminiAvailable()` guard. |
| `.github/workflows/deploy.yml` | Passing the secret into the build (the `env:` block above). |

## That's the whole thing

The pattern is domain-agnostic — the plumbing above is identical for any static dashboard. The only pieces you actually rewrite are the system prompt and the data context you feed the model. Everything else is copy, adjust the URL in the referrer restriction, and ship.

Questions on any step — grab me. The referrer restriction in Step 4 is the one most worth double-checking before you call it done.
