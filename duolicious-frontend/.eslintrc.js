// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  extends: 'expo',
  ignorePatterns: ['/dist/*'],
  rules: {
    "@typescript-eslint/no-empty-object-type": "off",
    "@typescript-eslint/no-redeclare": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        "argsIgnorePattern": "^_$",
        "varsIgnorePattern": "^_$",
        "caughtErrorsIgnorePattern": "^_$"
      }
    ],
    "react-hooks/exhaustive-deps": "off",
    "react/display-name": "off",
  }
};
