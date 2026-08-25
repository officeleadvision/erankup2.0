import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    rules: {
      // Legit "load on mount / fetch in effect" patterns across the dashboard;
      // flagged by the React Compiler rule. Tracked as warnings, not errors.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
