import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// Register service worker immediately (not deferred to window load)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/pwabuilder-sw.js")
    .catch(() => {});
}

const savedTheme = typeof window !== "undefined"
  ? localStorage.getItem("quizmaker_theme")
  : null;
if (savedTheme === "dark") {
  document.documentElement.classList.add("dark");
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
