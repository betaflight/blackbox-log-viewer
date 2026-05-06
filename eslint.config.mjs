import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default [
  {
    ignores: ["src/vendor/", "dist/", "public/", "test/"],
  },
  js.configs.recommended,
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
      "no-var": "error",
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-undef": "error",
      "no-redeclare": "error",
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
      eqeqeq: ["warn", "smart"],
      "prefer-const": "error",
      "prefer-template": "error",
      "comma-dangle": ["error", "always-multiline"],
      semi: ["error", "always"],
    },
  },
];
