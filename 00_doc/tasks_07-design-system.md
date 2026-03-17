# Phase 7: iOS 風格 Design System — Dark / Light Mode

## 背景

Phase 5C 完成暱稱審核 status 設計後，前端主題系統僅有 Light mode，且存在多處 hardcoded hex 色值。本 Phase 建立參考 iOS Human Interface Guidelines 的 Design System，融合 Antd token 體系，支援 Dark / Light mode 切換。

技術設計詳見 [rfc_07-design-system.md](rfc_07-design-system.md)。

## 前置條件

- Phase 5C 全部完成
- `npm run dev` 前後端正常啟動
- `npm test` 全部通過

---

## Task 7.1: Theme 基礎架構 — ThemeContext + getTheme

### 建立 / 修改檔案

1. `client/src/theme/context/ThemeContext.tsx`（新增）
   - `TThemeMode = 'light' | 'dark' | 'system'`
   - `IThemeContext`：`mode`, `resolvedMode`, `setTheme()`, `toggleTheme()`
   - `ThemeProvider`：
     - 初始化從 `localStorage.getItem('theme-mode')` 讀取，無值預設 `'system'`
     - `useEffect` 監聽 `window.matchMedia('(prefers-color-scheme: dark)')` 的 `change` 事件
     - `setTheme()` 同時更新 state 和 `localStorage`
     - `toggleTheme()` 循環：`light → dark → system → light`
     - 在 `<html>` 元素設定 `data-theme` attribute
   - 匯出 `useTheme` hook
   - 參照 [rfc_07 §5.1](rfc_07-design-system.md)

2. `client/src/theme/index.ts`（重構）
   - 移除原本的 `const theme: ThemeConfig` 預設匯出
   - 改為匯出 `getTheme(mode: 'light' | 'dark'): ThemeConfig` 函式
   - Light：`algorithm: antdTheme.defaultAlgorithm` + `lightSeedTokens`
   - Dark：`algorithm: antdTheme.darkAlgorithm` + `{ ...lightSeedTokens, ...darkSeedOverrides }`
   - 保留 `cssVar: {}` 和 `hashed: false`
   - 參照 [rfc_07 §5.2](rfc_07-design-system.md)

3. `client/src/App.tsx`（修改）
   - 匯入 `ThemeProvider`, `useTheme` from `./theme/context/ThemeContext`
   - 匯入 `getTheme` from `./theme`（取代原本的 `theme` default import）
   - 拆出 `AppContent` 內部元件，呼叫 `useTheme()` 取得 `resolvedMode`
   - `ThemeProvider` 包裹在最外層，`ConfigProvider theme={getTheme(resolvedMode)}` 在內層
   - 參照 [rfc_07 §5.7](rfc_07-design-system.md)

### 驗證方式

- `npm run dev` 啟動後頁面正常渲染（預設跟隨系統主題）
- 瀏覽器 DevTools Application → localStorage 有 `theme-mode` key
- `npm test` 通過（既有測試不受影響）

---

## Task 7.2: iOS 風格 Seed Tokens — 色彩系統

### 修改檔案

1. `client/src/theme/tokens/colors.ts`（重構）
   - 移除原本的 `colorTokens` 匯出
   - 改為匯出 `lightSeedTokens`（9 個 iOS 風格 seed tokens）和 `darkSeedOverrides`（`colorPrimary: '#2E88EE'`）
   - 參照 [rfc_07 §5.3](rfc_07-design-system.md)

2. `client/src/theme/tokens/spacing.ts`（修改）
   - `borderRadius: 6` → `10`
   - 新增 `borderRadiusLG: 14`、`borderRadiusSM: 8`
   - 參照 [rfc_07 §5.4](rfc_07-design-system.md)

3. `client/src/theme/tokens/typography.ts`（修改）
   - 新增 `fontWeightStrong: 600`
   - 參照 [rfc_07 §5.5](rfc_07-design-system.md)

4. `client/src/theme/tokens/index.ts`（修改）
   - 更新 colors 匯出：`colorTokens` → `lightSeedTokens`, `darkSeedOverrides`

### 驗證方式

- `npm run dev` 啟動後確認：
  - Primary 色為新的品牌藍 `#1A6FD4`
  - 圓角明顯變大（10px）
  - 成功 / 警告 / 錯誤色為 iOS 風格
- TypeScript 編譯無錯誤

---

## Task 7.3: Component Tokens 調整

### 修改 / 建立檔案

1. `client/src/theme/components/layout.ts`（修改）
   - 移除 `siderBg: '#001529'` 和 `headerBg: '#001529'`
   - 匯出空物件（讓 Antd algorithm 自動推導）
   - 參照 [rfc_07 §5.6](rfc_07-design-system.md)

2. `client/src/theme/components/table.ts`（修改）
   - 移除 `headerBg: '#F5F7FA'`
   - 匯出空物件
   - 參照 [rfc_07 §5.6](rfc_07-design-system.md)

3. `client/src/theme/components/button.ts`（修改）
   - 移除 `borderRadius: 6`（繼承 global token）
   - 匯出空物件
   - 參照 [rfc_07 §5.6](rfc_07-design-system.md)

4. `client/src/theme/components/card.ts`（新增）
   - `TCardToken` 型別定義
   - `cardTheme`：`boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)'`
   - 參照 [rfc_07 §5.6](rfc_07-design-system.md)

5. `client/src/theme/components/modal.ts`（新增）
   - `TModalToken` 型別定義
   - `modalTheme`：`boxShadow: '0 4px 16px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)'`
   - 參照 [rfc_07 §5.6](rfc_07-design-system.md)

6. `client/src/theme/components/index.ts`（修改）
   - 新增 `cardTheme`, `modalTheme` 匯出

### 驗證方式

- 全專案搜尋 `#001529`、`#F5F7FA` 確認已清除（僅文件中可保留）
- Card 元件顯示 iOS 風格細膩陰影
- `npm test` 通過

---

## Task 7.4: AdminLayout 適配

### 修改檔案

1. `client/src/layouts/AdminLayout.tsx`
   - 匯入 `useTheme` from `../theme/context/ThemeContext`
   - 匯入 `SunOutlined`, `MoonOutlined`, `DesktopOutlined` from `@ant-design/icons`
   - 移除 `<Menu theme="dark">`，改為不指定 theme 或根據 `resolvedMode` 設定
   - Header 右側加入主題切換按鈕：
     - Light 顯示 `SunOutlined`、Dark 顯示 `MoonOutlined`、System 顯示 `DesktopOutlined`
     - 點擊呼叫 `toggleTheme()`
   - `createStyles` 中：
     - `colorTextLightSolid` → `token.colorText`（不再假定深色背景）
     - 其他依賴深色背景的 token 需逐一調整
   - 參照 [rfc_07 §5.8](rfc_07-design-system.md)

### 驗證方式

- Light mode：Sidebar 為淺色背景、文字可讀
- Dark mode：Sidebar 為深色背景、文字可讀
- 切換按鈕可正常三態循環（light → dark → system → light）
- 選單高亮與路由同步正確

---

## Task 7.5: 全站頁面 Dark Mode 驗證

### 檢查檔案

逐頁檢查以下頁面在 Dark / Light mode 下的顯示是否正常：

1. `client/src/pages/LoginPage.tsx`
2. `client/src/pages/ChatMonitoringPage.tsx`
3. `client/src/pages/BlacklistPage.tsx`
4. `client/src/pages/ChatroomPage.tsx`
5. `client/src/pages/OperationLogPage.tsx`
6. `client/src/pages/NicknameReviewPage.tsx`
7. `client/src/pages/ReportReviewPage.tsx`
8. `client/src/components/ProtectedRoute.tsx`
9. `client/src/pages/NotFoundPage.tsx`

### 檢查重點

- 文字在背景上的對比度是否足夠
- Tag 顏色在 Dark mode 下是否可讀
- `createStyles` 中是否有殘留的 hardcoded hex 色值
- Modal / Card / Table 的 shadow 和 border 在 Dark mode 下是否合理
- 若發現問題，修正該頁面的 token 使用

### 驗證方式

- 每個頁面在 Light / Dark mode 下視覺正常
- 無殘留 hardcoded hex 色值（全域 grep 搜尋確認）
- `npm test` 全部通過

---

## Task 7.6: Prettier Format

### 步驟

- 執行 prettier 格式化所有本次修改的檔案：
  ```bash
  npx prettier --write \
    client/src/App.tsx \
    client/src/layouts/AdminLayout.tsx \
    client/src/theme/index.ts \
    client/src/theme/tokens/colors.ts \
    client/src/theme/tokens/spacing.ts \
    client/src/theme/tokens/typography.ts \
    client/src/theme/tokens/index.ts \
    client/src/theme/components/button.ts \
    client/src/theme/components/table.ts \
    client/src/theme/components/layout.ts \
    client/src/theme/components/card.ts \
    client/src/theme/components/modal.ts \
    client/src/theme/components/index.ts \
    client/src/theme/context/ThemeContext.tsx
  ```

### 驗證方式

- prettier 執行無錯誤
- `npm test` 通過

---

## 執行順序

```
Task 7.1 (ThemeContext + getTheme)
    ↓
Task 7.2 (iOS Seed Tokens)
    ↓
Task 7.3 (Component Tokens)
    ↓
Task 7.4 (AdminLayout 適配)
    ↓
Task 7.5 (全站 Dark Mode 驗證)
    ↓
Task 7.6 (Prettier Format)
```

**依賴關係**：

- Task 7.2、7.3 依賴 7.1（getTheme 函式結構必須先建立）
- Task 7.4 依賴 7.1（需要 useTheme hook）+ 7.3（layout token 已調整）
- Task 7.5 依賴 7.1～7.4 全部完成
- Task 7.6 在所有程式碼變更後執行

---

## 完成檢查清單

### Theme 架構

- [ ] `ThemeContext` 支援 light / dark / system 三態切換
- [ ] `localStorage` 持久化正常（重新整理頁面後主題保持）
- [ ] System mode 正確跟隨 OS 設定
- [ ] `getTheme()` 函式根據 mode 回傳正確的 ThemeConfig（含 algorithm）

### 色彩系統

- [ ] Light mode seed tokens 為 iOS 風格色彩
- [ ] Dark mode 使用 `darkAlgorithm` 自動推導 + 少量覆寫
- [ ] 全專案無殘留 hardcoded hex 色值（`#001529`、`#F5F7FA` 已清除）

### 視覺風格

- [ ] 圓角為 iOS 風格（10 / 14 / 8）
- [ ] Card / Modal 使用 iOS 風格細膩陰影
- [ ] 字型 `fontWeightStrong: 600`

### AdminLayout

- [ ] Sidebar 跟隨主題（Light 淺色、Dark 深色）
- [ ] Header 有主題切換按鈕（三態圖標切換）
- [ ] 無 `<Menu theme="dark">` hardcode

### 全站驗證

- [ ] 所有頁面在 Light / Dark mode 下顯示正常
- [ ] `npm test` 全部通過
- [ ] Prettier 格式化完成
