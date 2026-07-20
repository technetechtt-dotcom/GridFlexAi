module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'backend/**', 'Grid Flex/**'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
  overrides: [
    {
      files: ['load/k6/**/*.js', 'load/k6/**/*.mjs'],
      env: {
        browser: false,
        es2020: true,
        node: false,
      },
      globals: {
        __ENV: 'readonly',
        __VU: 'readonly',
        __ITER: 'readonly',
        __NU: 'readonly',
        open: 'readonly',
      },
    },
    {
      files: ['load/**/*.mjs', 'scripts/**/*.mjs'],
      env: { node: true, es2020: true, browser: false },
    },
  ],
}

