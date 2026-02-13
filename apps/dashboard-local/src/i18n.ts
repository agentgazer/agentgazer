import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import zhCN from "./locales/zh-CN.json";
import zhTW from "./locales/zh-TW.json";

const STORAGE_KEY = "agentgazer-lang";

// Detect browser language preference
function detectLanguage(): string {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return saved;

  const browserLang = navigator.language;
  if (browserLang.startsWith("zh")) {
    return browserLang.includes("TW") || browserLang.includes("HK")
      ? "zh-TW"
      : "zh-CN";
  }
  return "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "zh-CN": { translation: zhCN },
    "zh-TW": { translation: zhTW },
  },
  lng: detectLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

// Save language preference when changed
i18n.on("languageChanged", (lng) => {
  localStorage.setItem(STORAGE_KEY, lng);
});

export default i18n;
