import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// Register service worker immediately (not deferred to window load)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/pwabuilder-sw.js")
    .then((registration) => {
      console.log("Service Worker registered:", registration.scope);
    })
    .catch((error) => {
      console.error("Service Worker registration failed:", error);
    });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
