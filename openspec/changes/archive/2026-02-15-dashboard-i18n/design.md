## Design: Dashboard i18n

### Architecture

```
apps/dashboard-local/src/
├── i18n.ts                    # i18n configuration
├── locales/
│   ├── en.json                # English translations
│   ├── zh-CN.json             # 简体中文
│   └── zh-TW.json             # 繁體中文
├── components/
│   └── LanguageSwitcher.tsx   # Dropdown component
└── main.tsx                   # Import i18n.ts
```

### i18n Configuration

```typescript
// i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const savedLang = localStorage.getItem('agentgazer-lang');
const browserLang = navigator.language.startsWith('zh')
  ? (navigator.language.includes('TW') || navigator.language.includes('HK') ? 'zh-TW' : 'zh-CN')
  : 'en';

i18n.use(initReactI18next).init({
  resources: { en, 'zh-CN', 'zh-TW' },
  lng: savedLang || browserLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
});
```

### Translation Key Structure

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "loading": "Loading...",
    "error": "Error"
  },
  "nav": {
    "overview": "Overview",
    "agents": "Agents",
    "security": "Security"
  },
  "security": {
    "title": "Security Shield",
    "prompt_injection": "Prompt Injection Detection",
    ...
  }
}
```

### Language Switcher

- Location: Top-right of header
- Shows current language name
- Dropdown with 3 options
- On change: update i18n.language + save to localStorage

### Language Detection Priority

1. `localStorage.getItem('agentgazer-lang')`
2. `navigator.language` (browser setting)
3. Fallback to 'en'
