module.exports = {
  ...require('config/eslint-frontend'),
  rules: {
    ...require('config/eslint-frontend').rules,
    'import/no-unresolved': [2, { ignore: ['^@theme', '^@docusaurus', '^@site'] }],
  },
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: './tsconfig.json',
  },
}
