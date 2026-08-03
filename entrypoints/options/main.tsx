import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "../../assets/global.css";
import { initializeI18n } from "../../i18n";

async function main() {
  await initializeI18n();
  const root = document.getElementById("root")!;
  createRoot(root).render(<App />);
}

void main();
