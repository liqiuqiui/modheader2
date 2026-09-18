import { browser } from "wxt/browser";

export async function openOptionsPage(): Promise<void> {
  await browser.runtime.openOptionsPage();
}

export function closePopup(): void {
  window.close();
}
