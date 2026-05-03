# 11 — Firebase SDK modernization (deferred)

## Status

**No work to do today.** This document exists as a tripwire for future
contributors.

## Current state

Firebase usage is hosting-only. Evidence:

- `firebase.json` configures Hosting (and nothing else).
- No `firebase` package in `package.json` dependencies.
- No `import ... from 'firebase/...'` anywhere in `src/`.

Hosting deploys are CLI-driven (`firebase deploy --only hosting`,
about to be wrapped by plan 08's GitHub Action). Hosting itself doesn't
consume the JS SDK at runtime, so there is nothing to modernize.

## Trigger conditions

Open this plan and execute it the moment **any** of the following
becomes true:

- You add Firebase Auth (sign-in flows, anonymous auth, etc.).
- You add Firestore (replacing localStorage for list persistence).
- You add Cloud Functions (server-side logic, callable functions).
- You add Realtime Database, Cloud Storage, FCM, Analytics, or any
  other Firebase runtime SDK.
- You add Firebase emulators for local dev.

## What to do when triggered

Adopt the modular Firebase JS SDK pattern from the start. Do **not**
import the namespaced/legacy SDK ever — it's deprecated, larger
bundle, and Tree-shaking-hostile.

Modular pattern:

```js
// src/firebase.js (or .ts)
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  // public values; non-secret. From the Firebase console.
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
```

Consumers call functions, not methods on the service:

```js
import { signInAnonymously } from 'firebase/auth'
import { auth } from '@/firebase'
await signInAnonymously(auth)
```

Reasons this matters:

- Bundle: only the imported functions land in the build. The
  namespaced `firebase.auth().signInAnonymously()` form pulls in the
  whole service.
- Future-proofing: new Firebase features only ship in the modular API.
- Type ergonomics: each function has a tight signature. The namespaced
  form is harder to type cleanly.

## Related plans

- Plan 08 covers Firebase **Hosting** deploys via GitHub Actions. That
  doesn't use the JS SDK and isn't affected by this plan.
- If Firestore replaces localStorage for list persistence, plan 07's
  store tests will need to mock Firestore — `firebase/rules-unit-testing`
  or `@firebase/rules-unit-testing` is the canonical mock layer.

## Verification (when triggered)

```
grep -rn "from 'firebase'" src/   # → no matches (no namespaced imports)
grep -rn "from 'firebase/" src/   # → only modular subpath imports
```

Bundle check:

```
npm run build
ls -la dist/assets/*.js | sort -k 5 -n
```

Confirm no single chunk balloons disproportionately compared to before
the SDK was added.
