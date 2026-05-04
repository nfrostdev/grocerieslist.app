# Handoff 07 — Firebase security headers

## Goal

Add basic security response headers to Firebase Hosting. Cheap defense-in-depth for a PWA that handles user data via `?import=` URL params.

## Current state

`firebase.json` has only `public`, `ignore`, `rewrites`. No `headers` block.

External origins this app talks to (need to allow in CSP `connect-src`):

- `https://api-grocerieslist-app.uc.r.appspot.com` — share short-link API (`src/components/ShareButton.vue:34`)

External resources (CSP `font-src`, `img-src`, etc.):

- Font Awesome SVG icons — bundled, no remote
- Logo SVG — local
- `Barlow` font in `src/assets/main.css:19` — declared font-family but no `@import` or `<link>`. **System fallback only**, no remote font load. CSP `font-src 'self'` is enough.

## Changes

Add to `firebase.json`:

```json
"headers": [
  {
    "source": "**",
    "headers": [
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Permissions-Policy", "value": "geolocation=(), microphone=(), camera=()" },
      { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api-grocerieslist-app.uc.r.appspot.com; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" }
    ]
  }
]
```

Notes:

- `style-src 'self' 'unsafe-inline'` — Vite/Vue inject scoped styles inline; tightening this requires nonce/hash work, separate effort
- `worker-src 'self'` — needed for vite-plugin-pwa's `sw.js`
- No `X-Frame-Options` — superseded by CSP `frame-ancestors 'none'`

## Verification

- Deploy to a preview channel: `firebase hosting:channel:deploy hardening-test --project grocerieslist-app`
- `curl -I https://grocerieslist-app--hardening-test-xxxx.web.app` shows all four headers
- Browser → DevTools → Network → main doc → Response Headers shows them
- App still loads, share-link still works (CSP `connect-src` allows the appspot endpoint)
- DevTools console: no CSP violations

## Out of scope

- Tightening `style-src` (requires inline-style refactor)
- HSTS (Firebase Hosting sets it automatically)
- Migrating share API off appspot
