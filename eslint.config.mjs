import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

// Stylistic rules shared by JS and TS sources.
const sharedRules = {
  "no-var": "error",
  "no-prototype-builtins": "error",
  "no-empty": "error",
  "no-inner-declarations": "error",
  "no-fallthrough": "error",
  "no-useless-escape": "error",
  "no-constant-condition": "error",
  "no-unreachable": "error",
  "no-duplicate-case": "error",
  "no-dupe-keys": "error",
  "no-irregular-whitespace": "error",
  "no-case-declarations": "error",
  eqeqeq: ["error", "smart"],
  "prefer-const": "error",
  "prefer-template": "error",
  radix: "error",
  "comma-dangle": ["error", "always-multiline"],
  semi: ["error", "always"],
};

export default [
  {
    ignores: ["src/vendor/", "dist/", "public/", "test/"],
  },
  js.configs.recommended,
  // typescript-eslint scoped to TS sources only — JS keeps the core ruleset below.
  ...tseslint.config({
    files: ["src/**/*.ts"],
    extends: [tseslint.configs.recommended],
  }),
  eslintConfigPrettier,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        THREE: "readonly", // vendored three.min.js (r70, loaded via <script>)
        L: "readonly", // Leaflet (loaded via <script>)
        chrome: "readonly", // Chrome/Electron extension APIs (pref_storage.js)
        __APP_VERSION__: "readonly", // Vite define
      },
    },
    rules: {
      ...sharedRules,
      "no-undef": "error",
      "no-redeclare": "error",
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      ...sharedRules,
      // TypeScript's own checker handles undefined references and redeclarations.
      "no-undef": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];
