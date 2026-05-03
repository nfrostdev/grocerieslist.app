# 04 — ESLint flat config + plugin/preset bumps

## Why

Three tightly-coupled bumps land together because none of them is
useful alone:

- `eslint` 8 → 9 (flat config is the only supported format in 9+)
- `eslint-plugin-vue` 9 → 10 (10 is built for flat config)
- `@vue/eslint-config-standard` 8 → 9 (9 emits flat-config-shaped
  exports; 8 is `extends`-shaped and won't load under ESLint 9)

Vue CLI's lint plugin is gone, so `vue-cli-service lint` no longer
fights flat config. `@babel/eslint-parser` is also no longer needed —
we're not transpiling, and `vue-eslint-parser` handles the SFC blocks
natively.

## Current state

- `.eslintrc.js` — legacy format, extends `plugin:vue/vue3-essential`
  and `@vue/standard`, sets a parser, has a jest-env override.
- `.eslintignore` — `dist/`, `node_modules/`.
- Lint script: `eslint . --ext .js,.vue`.

## Target state

Single `eslint.config.js` at repo root. `.eslintrc.js` and
`.eslintignore` deleted. Lint script simplified to `eslint .` (flat
config drives the file targeting).

## Steps

1. Bump deps:
   ```
   npm i -D eslint@^9 eslint-plugin-vue@^10 @vue/eslint-config-standard@^9
   npm un @babel/eslint-parser
   ```
   Verify each `npm view <pkg> version` first to catch surprise majors.
2. Create `eslint.config.js`:
   ```js
   import js from '@eslint/js'
   import pluginVue from 'eslint-plugin-vue'
   import vueStandard from '@vue/eslint-config-standard'

   export default [
     { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
     js.configs.recommended,
     ...pluginVue.configs['flat/vue3-essential'],
     ...vueStandard,
     {
       rules: {
         'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
         'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
         'vue/multi-word-component-names': 'off'
       }
     },
     {
       files: ['tests/unit/**/*.spec.{js,ts}'],
       languageOptions: {
         globals: {
           describe: 'readonly',
           it: 'readonly',
           expect: 'readonly',
           beforeEach: 'readonly',
           afterEach: 'readonly',
           vi: 'readonly'
         }
       }
     }
   ]
   ```
   Notes:
   - The old jest-env override is rewritten as Vitest globals (we're on
     Vitest now). If `globals: true` in `vite.config.js#test` is being
     used, prefer importing the official `vitest/globals` types in the
     editor instead — but ESLint still needs the names declared.
   - `@vue/eslint-config-standard@9` ships a flat-config-native export
     (confirmed). No fallback needed.
   - `eslint-plugin-vue@10` dropped the `vue3-` prefix: the config key
     is `flat/essential` (not `flat/vue3-essential`).
   - Add a `globals` entry early in the array to declare browser + node
     globals; otherwise `alert`/`confirm` and similar browser APIs are
     flagged as `no-undef`. Import `globals` from the `globals` package
     (bundled with ESLint 9).
3. Delete `.eslintrc.js` and `.eslintignore`.
4. Update `package.json#scripts.lint`:
   ```json
   "lint": "eslint ."
   ```
5. Add `"type": "module"` to `package.json` if not already set
   (flat config files use ESM). Audit for any remaining CJS files
   (`postcss.config.js`, `tailwind.config.js`) — those will be
   removed by plan 05, so the audit is sequenced correctly.
   - If plan 05 hasn't landed yet, rename them to `.cjs` to keep
     them working until then.

## Verification

```
npm run lint
```

Expected: clean output. If rules disagree with the existing tree,
prefer fixing the code over relaxing the rules — but if a rule is
genuinely new and noisy (eslint-plugin-vue 10 adds a few), document
the suppression in this file and move on.

## Out of scope

- Flat-config-aware editor integration. VS Code's ESLint extension
  reads flat config out of the box on recent versions; older versions
  may need `"eslint.experimental.useFlatConfig": true`. Not this
  plan's job.
- TypeScript ESLint integration — deferred to plan 10.
