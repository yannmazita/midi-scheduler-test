import { scan } from "react-scan";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find the root element");

const root = createRoot(rootElement);

if (typeof window !== "undefined") {
  scan({
    enabled: true,
    log: false,
  });
}

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
