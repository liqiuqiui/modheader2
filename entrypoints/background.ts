import { defineBackground } from "wxt/utils/define-background";
import { profilesStorage, selectedIndexStorage, isPausedStorage } from "../store";
import { profilesToDnrRules, applyDnrRules } from "../utils/dnr";
import i18n, { initializeI18n } from "../i18n";
import { localeStorage } from "../store/locale";

async function syncRules() {
  const [profiles, selectedIndex, isPaused] = await Promise.all([
    profilesStorage.getValue(),
    selectedIndexStorage.getValue(),
    isPausedStorage.getValue(),
  ]);

  const rules = profilesToDnrRules(profiles, selectedIndex, isPaused);
  await applyDnrRules(rules);
}

export default defineBackground(() => {
  // 初始化时同步规则
  syncRules();

  // 监听 storage 变化，重新应用规则
  profilesStorage.watch(() => syncRules());
  selectedIndexStorage.watch(() => syncRules());
  isPausedStorage.watch(() => syncRules());

  const syncContextMenu = async () => {
    await initializeI18n();
    const [locale, paused] = await Promise.all([
      localeStorage.getValue(),
      isPausedStorage.getValue(),
    ]);
    const t = i18n.getFixedT(locale);
    await browser.contextMenus.update("toggle_pause", {
      title: t(paused ? "context.resume" : "context.pause"),
    });
  };

  const createContextMenu = async () => {
    await initializeI18n();
    const [locale, paused] = await Promise.all([
      localeStorage.getValue(),
      isPausedStorage.getValue(),
    ]);
    const t = i18n.getFixedT(locale);
    browser.contextMenus.create({
      id: "toggle_pause",
      title: t(paused ? "context.resume" : "context.pause"),
      contexts: ["action"],
    });
  };

  void createContextMenu();
  localeStorage.watch(() => void syncContextMenu());
  isPausedStorage.watch(() => void syncContextMenu());

  browser.contextMenus.onClicked.addListener(async (info) => {
    if (info.menuItemId === "toggle_pause") {
      const current = await isPausedStorage.getValue();
      await isPausedStorage.setValue(!current);
      await syncContextMenu();
    }
  });
});
