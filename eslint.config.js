import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // Checked-in codegen output, not source. `npm run generate` regenerates it;
    // CI verifies it stays in sync (see .github/workflows/ci.yml).
    ignores: [
      "**/dist/**",
      "**/dist-test/**",
      "**/node_modules/**",
      "packages/codec/src/gen/**",
      "packages/domain/src/generated/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  {
    // eslint-plugin-svelte's recommended config already assigns the Svelte
    // parser to *.svelte and *.svelte.ts/js; it just needs to know which
    // parser to hand script contents off to.
    files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".svelte"],
      },
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["packages/pwa/**/*.{ts,svelte}"],
    languageOptions: { globals: globals.browser },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // Bare `someState.prop;` statements inside `$effect` are how Svelte 5 runes
    // are told to track a value with no other use for it — not dead code.
    files: ["**/*.svelte"],
    rules: {
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
  prettier,
  ...svelte.configs.prettier,
);
