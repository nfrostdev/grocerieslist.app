import js from '@eslint/js'
import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'
import vueA11y from 'eslint-plugin-vuejs-accessibility'
import vueStandard from '@vue/eslint-config-standard'
import tseslint from 'typescript-eslint'

export default [
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', '.wrangler/**'] },
  js.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  ...tseslint.configs.recommended,
  {
    files: ['functions/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
      globals: { ...globals.worker, D1Database: 'readonly' }
    }
  },
  ...pluginVue.configs['flat/essential'],
  ...vueStandard,
  ...vueA11y.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser }
    }
  },
  {
    rules: {
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'vue/multi-word-component-names': 'off',
      // Static analyzer cannot resolve dynamic `:for` bindings (e.g. `:for="`item-name-${item.id}`"`),
      // so the rule produces false positives across ListItem.vue, List.vue, etc.
      // Coverage relied on:
      //   • axe e2e runs in tests/e2e/smoke.spec.ts and tests/e2e/sync.spec.ts
      //     (wcag2a, wcag2aa, wcag21a, wcag21aa — includes axe rules `label`,
      //     `form-field-multiple-labels`, `label-content-name-mismatch`,
      //     `aria-input-field-name`).
      //   • These flag any input whose accessible name is missing at runtime,
      //     which is the actual user-visible failure mode this lint rule
      //     attempts to anticipate statically.
      'vuejs-accessibility/label-has-for': 'off',
      'vuejs-accessibility/no-autofocus': 'error',
      'vuejs-accessibility/no-static-element-interactions': 'error',
      'no-void': ['error', { allowAsStatement: true }]
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
  },
  {
    files: ['tests/integration/**/*.ts'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
        D1Database: 'readonly'
      }
    }
  }
]
