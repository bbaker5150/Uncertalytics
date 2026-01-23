import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  // 1. Global Ignores: Files/Folders ESLint should completely stay out of
  { 
    ignores: [
      "dist", 
      "release", 
      "node_modules", 
      "out", 
      "overhaul.js" // Ignored for now due to the high number of undefined variables
    ] 
  },
  
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser, // For React frontend
        ...globals.node,    // For Electron main/logic
        ...globals.vitest,  // For App.test.jsx and setupTests.js
        ...globals.es2020,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true, // This fixes the "Unexpected token <" errors
        },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // Standard recommended rules
      ...js.configs.recommended.rules,
      
      // React Hooks rules (including the setState in effect check)
      ...reactHooks.configs.recommended.rules,
      
      // Vite specific rules
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      // Custom rule adjustments for Uncertalytics
      "no-unused-vars": "warn", 
      "no-empty": "warn",       // Changed from error to warn for empty catch blocks
      "no-dupe-keys": "error",  // Keeps your math objects clean
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];