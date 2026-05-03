# 05 — Tailwind 3 → 4

## Why

Tailwind 4 is a ground-up rewrite:

- CSS-first config (`@theme` block) replaces `tailwind.config.js`.
- Native Vite plugin (`@tailwindcss/vite`) replaces the PostCSS pipeline.
- No more `autoprefixer` / `postcss.config.js` — Tailwind 4 ships its
  own pipeline using Lightning CSS.
- Significant build-time speedup; smaller dev rebuilds.

It was held back by Vue CLI / webpack. With Vite canonical, we should
move now rather than letting `tailwindcss@3` accumulate.

## Current state

- `tailwindcss@^3.4.19`, `autoprefixer@^10.5.0`, `postcss@^8.5.13`.
- `postcss.config.js` — registers tailwindcss + autoprefixer plugins.
- `tailwind.config.js` — content globs, `darkMode: 'media'`, custom
  `gl-*` color palette.
- `src/assets/main.css` — `@tailwind base; @tailwind components;
  @tailwind utilities;`.
- `vite.config.js` — no Tailwind plugin (uses PostCSS implicitly).

## Target state

- `@tailwindcss/vite` registered in `vite.config.js`.
- `postcss.config.js` deleted, `autoprefixer` removed from devDeps.
- `tailwind.config.js` deleted.
- `src/assets/main.css` opens with `@import "tailwindcss";` and a
  `@theme` block carrying the `gl-*` palette.

## Steps

1. Install:
   ```
   npm i -D tailwindcss@^4 @tailwindcss/vite
   npm un autoprefixer postcss
   ```
   `postcss` may still be a transitive dep — that's fine, removing it
   from direct devDeps is what matters.
2. Edit `vite.config.js`:
   ```js
   import tailwindcss from '@tailwindcss/vite'
   // ...
   plugins: [
     vue(),
     tailwindcss(),
     VitePWA({ /* unchanged */ })
   ]
   ```
3. Rewrite `src/assets/main.css`:
   ```css
   @import "tailwindcss";

   @theme {
     --color-gl-lightblue: #BEC4E5;
     --color-gl-blue: #A3ACE0;
     --color-gl-darkblue: #283380;
     --color-gl-deep-blue: #010A33;
     --color-gl-blueberry: #5368E6;
     --color-gl-muted-blue: #434971;
     --color-gl-lightgray: #E7E9F3;
     --color-gl-gray: #BEC4E5;
     --color-gl-lightgreen: #57CF7E;
     --color-gl-green: #3B9158;
   }
   ```
   - Tailwind 4 generates `bg-gl-blueberry`, `text-gl-darkblue`, etc.
     from `--color-gl-*` tokens automatically.
   - `darkMode: 'media'` is the default behavior in v4 — no config
     needed.
   - Content globs are auto-detected in v4 — no need to list them.
4. Delete `tailwind.config.js`. Delete `postcss.config.js`.
5. Search the codebase for any utility class that doesn't survive
   v4's renames (a few `*-opacity` utilities became opacity modifiers,
   `flex-grow` became `grow`, etc.):
   ```
   grep -rn "bg-opacity-\|text-opacity-\|flex-grow\|flex-shrink" src/
   ```
   Apply renames as needed.

## Verification

1. `npm run build` — passes, no PostCSS warnings.
2. `npm run serve` — open Lists, List, New views. Visual diff against
   pre-upgrade screenshots.
3. Confirm `gl-blueberry`, `gl-darkblue`, `gl-lightgreen` etc. resolve
   correctly. (Search the templates: there should be a handful of
   `bg-gl-*` / `text-gl-*` classes.)
4. Toggle OS dark mode, confirm `media`-driven dark styles still flip.

## Out of scope

Component-level styling refactor. If a view has hand-rolled CSS that
predates Tailwind, leave it — this plan is the framework bump only.
