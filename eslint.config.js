import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "reference", "public/garage"] },
  {
    // Vendored verbatim from the R2 engineering drawing so the two trees stay
    // diffable. Reformatting it to satisfy lint would break that, and the
    // showroom layer next to it is linted normally.
    ignores: ["src/scene/r2/geom.js", "src/scene/r2/vehicle.js"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
);
