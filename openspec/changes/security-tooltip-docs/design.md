## Context

SecurityPage 已實作完整的安全規則 toggle UI，但缺乏說明。用戶看到 "System prompt override" 不知道這在檢測什麼。需要加入 tooltip 和對應文件讓用戶理解每個選項。

現有元件：
- `ToggleRow` - 目前只接受 label, checked, onChange
- VitePress docs 已有 en/zh 雙語結構

## Goals / Non-Goals

**Goals:**
- 每個安全規則 toggle 旁顯示 info icon
- Hover 顯示 tooltip 含說明、範例、文件連結
- 建立完整的 Security 文件頁面（雙語）
- 文件連結可直接跳到對應 section

**Non-Goals:**
- 不改變現有安全規則邏輯
- 不加入新的安全規則
- 不做 tooltip 的 click-to-pin 功能

## Decisions

### 1. Tooltip 實作方式
**Decision**: 擴展 `ToggleRow` 元件加入可選的 `tooltip` prop

**Alternatives considered:**
- 獨立 Tooltip 元件包裹每個 ToggleRow → 過度複雜
- 使用 CSS-only tooltip → 無法支援 rich content 和連結

**Rationale:** 最小改動，保持元件封裝

### 2. Tooltip 內容管理
**Decision**: 在 SecurityPage 定義 `TOOLTIP_CONTENT` 常數物件，key 對應規則名稱

```typescript
const TOOLTIP_CONTENT: Record<string, TooltipData> = {
  system_override: {
    title: "System prompt override",
    description: "Detects attempts to override or replace system instructions",
    examples: ["new system prompt", "enable developer mode", "override system"],
    docsAnchor: "#system-override"
  },
  // ...
};
```

**Rationale:** 集中管理，易於維護和翻譯

### 3. 文件 URL 結構
**Decision**: `/guide/security` 作為文件路徑，各 section 使用 kebab-case anchor

- `/en/guide/security#prompt-injection`
- `/en/guide/security#system-override`
- `/zh/guide/security#prompt-injection`

**Rationale:** 符合現有 docs 結構慣例

## Risks / Trade-offs

**[Risk]** Tooltip 內容與實際 patterns 不同步
→ Mitigation: 內容直接參考 `security-patterns.ts` 的註解和 pattern 定義

**[Risk]** 雙語文件維護成本
→ Mitigation: 結構相同，只需翻譯文字；先完成英文再翻譯中文

**[Trade-off]** Tooltip 顯示範例數量
→ 選擇顯示 2-3 個代表性範例，完整列表在文件中
