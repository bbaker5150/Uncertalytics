import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import react from "eslint-plugin-react";

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
    settings: {
      react: { version: 'detect' },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      react,
    },
    rules: {
      // Standard recommended rules
      ...js.configs.recommended.rules,
      
      // React rules
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,

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
      
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",

      // Suppress prop-types enforcement if not using them
      "react/prop-types": "off",
    },
  },
];