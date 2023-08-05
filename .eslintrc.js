module.exports = {
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    root: true,
    env: {},
    parserOptions: {
        'ecmaVersion': 'latest',
        'sourceType': 'module'
    },
    rules: {
        semi: ['error', 'always'],
        quotes: ['error', 'single'],
        eqeqeq: ['error', 'smart'],

        'array-bracket-spacing': ['error', 'never', { singleValue: false, objectsInArrays: false, arraysInArrays: false }],
        'array-element-newline': ['error', 'consistent'],

        'comma-dangle': ['error', 'always-multiline'],
        'comma-spacing': ['error', { before: false, after: true }],

        'no-var': 'error',
        'prefer-const': 'error',
        'prefer-rest-params': 'error',
        'prefer-spread': 'error',
        'prefer-regex-literals': 'error',
        'prefer-template': 'error',
        'no-useless-concat': 'error',

        'indent': ['error', 4, { SwitchCase: 1 }],
        'no-tabs': 'error',

        'max-len': ['error', { code: 120, ignoreComments: true, ignoreTrailingComments: true, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreRegExpLiterals: true }],
        'max-depth': ['error', 4],
        'max-lines': ['error', 500],

        'camelcase': 'error',
        'curly': ['error', 'multi'],
        'func-style': ['error', 'declaration', { 'allowArrowFunctions': true }],
        'spaced-comment': ['error', 'always', { 'line': { 'markers': ['/'] }, 'block': { 'balanced': true } }],
        'yoda': ['error', 'never', { 'exceptRange': true }],
    },
};