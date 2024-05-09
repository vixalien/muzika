module.exports = {
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    // "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:prettier/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    sourceType: "module",
    project: "./tsconfig.json",
    warnOnUnsupportedTypeScriptVersion: false,
  },
  rules: {
    "@typescript-eslint/restrict-template-expressions": ["error", {
      allowNullish: true,
    }],
    "prettier/prettier": "error",
  },
  plugins: ["@typescript-eslint"],
  root: true,
};
