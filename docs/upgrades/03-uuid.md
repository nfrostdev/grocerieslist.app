# 03 — Bump uuid 9 → current

## Why

`uuid@9` was held back because webpack 4 / Vue CLI couldn't transpile the
ESM-only optional-chaining in `uuid@10+`. With Vite, that constraint is
gone. Latest also drops legacy CJS surface and trims bundle size.

## Surface

Two import sites only:

- `src/classes/Item.js:1` — `import { v4 as uuidv4 } from 'uuid'`
- `src/classes/List.js:1` — `import { v4 as uuidv4 } from 'uuid'`

Both call `uuidv4().substring(0, 8)` — the API hasn't changed in any
recent major, so no code edits are expected. Verify before assuming.

## Steps

1. `npm view uuid version` to confirm latest stable major.
2. `npm i uuid@latest`.
3. Read the migration notes for any major you cross
   (`https://github.com/uuidjs/uuid/blob/main/CHANGELOG.md`). The
   recurring breaking change is dropping subpath imports
   (`uuid/v4`); this project uses the named export (`{ v4 }`) so it's
   unaffected, but confirm.
4. No code changes expected. If migration notes do require a change at
   either call site, apply it.

## Verification

```
npm run build
npm run test:unit
npm run serve
```

Then in browser:

1. Visit `/new`, create a list. Confirm the URL becomes `/<8-char-id>`.
2. On the new list, add an item. Confirm it renders without console
   errors.
3. Confirm both ids are valid uuid prefixes (8 hex chars).

## Out of scope

The choice to truncate uuid to 8 chars is preserved as-is — it's a
collision-acceptable shortener, not something this upgrade changes.
