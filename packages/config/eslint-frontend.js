function noRestrictedSyntaxOverride() {
  const {
    rules: { 'no-restricted-syntax': noRestrictedSyntaxRule },
  } = require('eslint-config-airbnb-base/rules/style')
  const [value, ...options] = noRestrictedSyntaxRule

  return {
    'no-restricted-syntax': [
      value,
      ...options.filter((option) => option.selector !== 'ForOfStatement'),
    ],
  }
}

module.exports = {
  env: {
    browser: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'next',
    'airbnb',
    'airbnb-typescript',
    'airbnb/hooks',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
    'plugin:react/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:@next/next/recommended',
  ],
  plugins: [...require('./eslint-common').plugins, 'better-styled-components'],
  settings: {
    ...require('./eslint-common').settings,
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
  },
  rules: {
    ...require('./eslint-common').rules,

    // Removes the restriction of "for..of".
    // This restriction is pretty debatable and doesn't help our project
    // See https://github.com/airbnb/javascript/issues/1271
    ...noRestrictedSyntaxOverride(),

    // disabled until they support the specific value pattern ex : text-color-opacity-[63%]
    'better-styled-components/sort-declarations-alphabetically': 2,
    // react
    'react/function-component-definition': 'off',
    'react/jsx-filename-extension': 'off',
    'react/jsx-no-useless-fragment': ['error', { allowExpressions: true }],
    'react/jsx-props-no-spreading': ['warn', { html: 'ignore' }],
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/require-default-props': 'off',

    // next
    '@next/next/no-html-link-for-pages': 'off',
    '@next/next/no-img-element': 'off',
  },
  overrides: require('./eslint-common').overrides,
  ignorePatterns: require('./eslint-common').ignorePatterns,
}
