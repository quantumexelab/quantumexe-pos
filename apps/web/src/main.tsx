import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { LanguageProvider } from "./i18n";
import { NotifyProvider } from "./notify";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <NotifyProvider>
          <App />
        </NotifyProvider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>
);
