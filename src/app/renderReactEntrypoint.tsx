import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "../assets/global.css";
import { initializeI18n } from "../i18n";

export async function renderReactEntrypoint(content: ReactNode) {
  await initializeI18n();
  const root = document.getElementById("root");
  if (!root) throw new Error("Missing #root element");
  createRoot(root).render(content);
}
