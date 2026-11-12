const js = require('@eslint/js');

module.exports = [
  {
    ignores: ['coverage/**', 'node_modules/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        module: 'readonly',
        require: 'readonly',
      },
    },
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        console: 'readonly',
        describe: 'readonly',
        expect: 'readonly',
        module: 'readonly',
        process: 'readonly',
        require: 'readonly',
        test: 'readonly',
      },
    },
  },
];
