import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default [
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
      "no-var": "warn",
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-undef": "warn",
      "no-redeclare": "warn",
      "no-prototype-builtins": "warn",
      "no-empty": "warn",
      "no-inner-declarations": "warn",
      "no-fallthrough": "warn",
      "no-useless-escape": "warn",
      "no-constant-condition": "warn",
      "no-unreachable": "warn",
      "no-duplicate-case": "warn",
      "no-dupe-keys": "warn",
      "no-irregular-whitespace": "warn",
      "no-case-declarations": "warn",
      "prefer-const": "warn",
      "prefer-template": "warn",
      "comma-dangle": ["warn", "always-multiline"],
      semi: ["error", "always"],
    },
  },
];
