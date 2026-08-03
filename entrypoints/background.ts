import { defineBackground } from "wxt/utils/define-background";
import { profilesStorage, selectedIndexStorage } from "../store";
import { profilesToDnrRules, applyDnrRules } from "../utils/dnr";
import i18n, { initializeI18n } from "../i18n";
import { localeStorage } from "../store/locale";

async function syncRules() {
  const [profiles, selectedIndex] = await Promise.all([
    profilesStorage.getValue(),
    selectedIndexStorage.getValue(),
  ]);

  const rules = profilesToDnrRules(profiles, selectedIndex);
  await applyDnrRules(rules);
}

export default defineBackground(() => {
  // 初始化时同步规则
  syncRules();

  // 监听 storage 变化，重新应用规则
  profilesStorage.watch(() => syncRules());
  selectedIndexStorage.watch(() => syncRules());

  const syncContextMenu = async () => {
    await initializeI18n();
    const [locale, profiles, selectedIndex] = await Promise.all([
      localeStorage.getValue(),
      profilesStorage.getValue(),
      selectedIndexStorage.getValue(),
    ]);
    const t = i18n.getFixedT(locale);
    const paused = profiles[selectedIndex]?.paused ?? false;
    await browser.contextMenus.update("toggle_pause", {
      title: t(paused ? "context.resume" : "context.pause"),
    });
  };

  const createContextMenu = async () => {
    await initializeI18n();
    const [locale, profiles, selectedIndex] = await Promise.all([
      localeStorage.getValue(),
      profilesStorage.getValue(),
      selectedIndexStorage.getValue(),
    ]);
    const t = i18n.getFixedT(locale);
    const paused = profiles[selectedIndex]?.paused ?? false;
    browser.contextMenus.create({
      id: "toggle_pause",
      title: t(paused ? "context.resume" : "context.pause"),
      contexts: ["action"],
    });
  };

  void createContextMenu();
  localeStorage.watch(() => void syncContextMenu());
  profilesStorage.watch(() => void syncContextMenu());
  selectedIndexStorage.watch(() => void syncContextMenu());

  browser.contextMenus.onClicked.addListener(async (info) => {
    if (info.menuItemId === "toggle_pause") {
      const [profiles, selectedIndex] = await Promise.all([
        profilesStorage.getValue(),
        selectedIndexStorage.getValue(),
      ]);
      if (!profiles[selectedIndex]) return;
      await profilesStorage.setValue(
        profiles.map((profile, index) =>
          index === selectedIndex ? { ...profile, paused: !profile.paused } : profile,
        ),
      );
      await syncContextMenu();
    }
  });
});
