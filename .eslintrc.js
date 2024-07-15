module.exports = {
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  extends: ['eslint:recommended', 'prettier'],
  root: true,
  env: {
    node: true,
    jquery: true,
    es2017: true,
    browser: true,
    webextensions: true,
  },
  rules: {
    // TODO: currently a lot of these issues are marked as
    // warnings because they are in the codebase already
    // and I don't want to fix them all at once.
    // Eventually, they should be fixed and the rules
    // should be set to 'error' (default in preset).
    'no-var': 'warn',
    'no-unused-vars': 'warn',
    'no-undef': 'warn',
    'no-redeclare': 'warn',
    'no-prototype-builtins': 'warn',
    'no-empty': 'warn',
    'no-inner-declarations': 'warn',
    'no-fallthrough': 'warn',
    'no-useless-escape': 'warn',
    'no-constant-condition': 'warn',
    'no-unreachable': 'warn',
    'no-duplicate-case': 'warn',
    'no-dupe-keys': 'warn',
    'no-irregular-whitespace': 'warn',
    'no-case-declarations': 'warn',
    'prefer-template': 'warn',
    'comma-dangle': ['warn', 'always-multiline'],
    semi: ['error', 'always'],
  },
};
