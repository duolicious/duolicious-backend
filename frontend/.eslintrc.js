// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  extends: 'expo',
  // public/assets holds the static pages copied from duolicious.app, whose
  // scripts aren't app code; service-worker.js and the rest of public/ are
  // still linted.
  ignorePatterns: ['/dist/*', '/public/assets/*'],
  rules: {
    "@typescript-eslint/no-empty-object-type": "off",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-redeclare": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_$",
        "varsIgnorePattern": "^_$",
        "caughtErrorsIgnorePattern": "^_$"
      }
    ],
    "react-hooks/exhaustive-deps": "off",
    "react-hooks/immutability": "off",
    "react-hooks/preserve-manual-memoization": "off",
    "react-hooks/purity": "off",
    "react-hooks/refs": "off",
    "react-hooks/set-state-in-effect": "off",
    "react-hooks/static-components": "off",
    "react-hooks/use-memo": "off",
    "react/display-name": "off",
  }
};
