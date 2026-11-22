import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { startCloudSync } from "./lib/platform";
import { applyEmbeddedPacks } from "./lib/store";

// Hors claude.ai : on importe tout de suite. Dans claude.ai, on attend d'avoir chargé la sauvegarde en ligne
// (sinon elle écraserait l'import), voir startCloudSync.
if (!(window as { claude?: unknown }).claude) applyEmbeddedPacks();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

void startCloudSync();
