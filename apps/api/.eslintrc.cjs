/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.json', './tsconfig.test.json'],
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  rules: {
    // I-05 (terceira camada): impede UPDATE/DELETE acidental em registro_entradas no código
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.property.name='updateTable'][arguments.0.value='registro_entradas']",
        message: 'registro_entradas é append-only (I-05). Use apenas selectFrom ou insertInto.',
      },
      {
        selector: "CallExpression[callee.property.name='deleteFrom'][arguments.0.value='registro_entradas']",
        message: 'registro_entradas é append-only (I-05). Exclusão não é permitida.',
      },
    ],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.cjs'],
}
