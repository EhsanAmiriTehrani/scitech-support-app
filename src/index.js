import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app";  // Changed to match the actual file name casing

// Set base URL for GitHub Pages
const baseUrl = process.env.PUBLIC_URL || '';
window.baseUrl = baseUrl;  // Makes it available globally if needed

// Create root and render
const root = createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Optional debug log
console.log(`Application mounted with base URL: ${baseUrl}`);