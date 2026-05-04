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
        ...globals.jquery,
      },
    },
    rules: {
      "no-var": "warn",
      "no-unused-vars": "warn",
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
      "prefer-template": "warn",
      "comma-dangle": ["warn", "always-multiline"],
      semi: ["error", "always"],
    },
  },
];
