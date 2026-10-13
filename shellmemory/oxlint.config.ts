import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";

export default defineConfig({
  extends: [core],
  ignorePatterns: core.ignorePatterns,
  rules: {
    // Owner preference: allow arrow-function style.
    "func-style": "off",
    "react/function-component-definition": "off",
  },
});
