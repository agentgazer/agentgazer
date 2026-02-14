## Why

Dashboard currently has all text hardcoded in English. Users in Chinese-speaking regions need localized UI.

## What Changes

- Add react-i18next for runtime language switching
- Create translation files for English, Simplified Chinese, Traditional Chinese
- Add language switcher dropdown in header
- Persist language preference in localStorage
- Default to browser language

## Capabilities

### New Capabilities

None - this is a UI enhancement, not a new capability.

### Modified Capabilities

None - no spec-level behavior changes.

## Impact

- `apps/dashboard-local/` - All pages and components need translation keys
- New dependencies: `react-i18next`, `i18next`
- New files: `src/locales/*.json`, `src/i18n.ts`, `src/components/LanguageSwitcher.tsx`
