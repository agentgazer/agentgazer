import { describe, it, expect, beforeEach } from "vitest";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import zhCN from "./locales/zh-CN.json";
import zhTW from "./locales/zh-TW.json";

// Set up a fresh i18n instance for testing (avoiding side effects from the app's i18n.ts)
function createI18nInstance(lng = "en") {
  const instance = i18n.createInstance();
  instance.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      "zh-CN": { translation: zhCN },
      "zh-TW": { translation: zhTW },
    },
    lng,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
  });
  return instance;
}

describe("i18n locale switching", () => {
  let instance: ReturnType<typeof createI18nInstance>;

  beforeEach(() => {
    instance = createI18nInstance("en");
  });

  it("defaults to English translations", () => {
    expect(instance.language).toBe("en");
    expect(instance.t("login.title")).toBe("AgentGazer");
    expect(instance.t("login.submit")).toBe("Login");
    expect(instance.t("overview.title")).toBe("Overview");
  });

  it("switches to zh-TW", async () => {
    await instance.changeLanguage("zh-TW");
    expect(instance.language).toBe("zh-TW");
    expect(instance.t("login.submit")).toBe("\u767B\u5165"); // 登入
    expect(instance.t("overview.title")).toBe("\u7E3D\u89BD"); // 總覽
    expect(instance.t("agents.title")).toBe("\u667A\u80FD\u9AD4"); // 智能體
  });

  it("switches to zh-CN", async () => {
    await instance.changeLanguage("zh-CN");
    expect(instance.language).toBe("zh-CN");
    expect(instance.t("common.save")).toBe("\u4FDD\u5B58"); // 保存
  });

  it("falls back to English for missing keys", async () => {
    // If a key exists in en but not in zh-TW, fallback should work
    await instance.changeLanguage("zh-TW");
    // All keys should exist in zh-TW, but test fallback mechanism
    const result = instance.t("nonexistent.key");
    expect(result).toBe("nonexistent.key"); // Returns key path when not found
  });

  it("can switch between all three locales", async () => {
    expect(instance.t("nav.overview")).toBe("Overview");

    await instance.changeLanguage("zh-CN");
    expect(instance.t("nav.overview")).toBe("\u6982\u89C8"); // 概览

    await instance.changeLanguage("zh-TW");
    expect(instance.t("nav.overview")).toBe("\u7E3D\u89BD"); // 總覽

    await instance.changeLanguage("en");
    expect(instance.t("nav.overview")).toBe("Overview");
  });
});

describe("i18n locale completeness", () => {
  function getKeys(obj: Record<string, unknown>, prefix = ""): string[] {
    const keys: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        keys.push(...getKeys(value as Record<string, unknown>, fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    return keys;
  }

  it("zh-TW has all keys that en has", () => {
    const enKeys = getKeys(en);
    const zhTWKeys = getKeys(zhTW);

    const missingInZhTW = enKeys.filter((key) => !zhTWKeys.includes(key));
    expect(missingInZhTW).toEqual([]);
  });

  it("zh-CN has all keys that en has", () => {
    const enKeys = getKeys(en);
    const zhCNKeys = getKeys(zhCN);

    const missingInZhCN = enKeys.filter((key) => !zhCNKeys.includes(key));
    expect(missingInZhCN).toEqual([]);
  });
});
