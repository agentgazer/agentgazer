import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
];

interface LanguageSwitcherProps {
  collapsed?: boolean;
}

export default function LanguageSwitcher({ collapsed }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();

  const currentLang = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];

  if (collapsed) {
    return (
      <button
        onClick={() => {
          const currentIndex = LANGUAGES.findIndex((l) => l.code === i18n.language);
          const nextIndex = (currentIndex + 1) % LANGUAGES.length;
          i18n.changeLanguage(LANGUAGES[nextIndex].code);
        }}
        className="flex w-full items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
        title={currentLang.label}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
        </svg>
      </button>
    );
  }

  return (
    <div className="relative">
      <select
        value={i18n.language}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className="w-full appearance-none rounded-md border border-gray-700 bg-gray-800 px-3 py-2 pr-8 text-sm text-gray-300 transition-colors hover:bg-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
