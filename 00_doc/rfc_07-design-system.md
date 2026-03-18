# RFC: iOS 風格 Design System — Dark / Light Mode

## 1. 背景

Phase 5C（[rfc_05](rfc_05-nickname-and-report.md)）完成暱稱審核改用 status 設計。目前前端主題系統存在以下問題：

1. **僅有 Light mode** — 不支援 Dark mode，無法適應不同使用場景與使用者偏好
2. **Hardcoded 色值** — Layout sidebar `#001529`、Table header `#F5F7FA` 等直接寫死 hex 值，無法隨主題切換
3. **色彩系統缺乏系統性** — Seed tokens 沿用 Antd 預設值，未建立統一的視覺語言

本 RFC 建立一套參考 iOS Human Interface Guidelines 的 Design System，融合 Antd token 體系，同時支援 Dark / Light mode 切換。

**範圍界定**：本 RFC 涵蓋色彩系統重新定義、視覺風格調整（圓角、陰影、分割線、字型）、Theme 切換架構、現有頁面適配。採用基礎版 iOS 風格（不含毛玻璃效果）。

---

## 2. 目標

- 建立 iOS 風格 + Antd token 的統一色彩系統（Seed Tokens）
- 支援 dark / light / system 三態主題切換（預設跟隨系統）
- 移除所有 hardcoded hex 色值，改用 semantic token 或 Antd algorithm 推導
- 調整視覺元素（圓角、陰影、分割線、字型）趨近 iOS 基礎風格
- Sidebar 跟隨主題（Light 時淺色、Dark 時深色）

---

## 3. 提案

### 3.1 技術方案 — Antd Algorithm 派

使用 Antd 內建的 `defaultAlgorithm`（Light）/ `darkAlgorithm`（Dark）作為基底，透過 seed token 調整配色趨近 iOS，component token 處理 iOS 視覺特徵。

**優勢**：

- Antd 自動推導所有衍生色（Map Tokens），維護成本最低
- Dark mode 轉換只需切換 algorithm，不需手動管理 50+ token × 2 套
- 與 Antd 生態系相容性最高

### 3.2 色彩系統（Seed Tokens）

#### Light Mode Seed Tokens

| Token              | 現值      | 新值      | 說明                                              |
| ------------------ | --------- | --------- | ------------------------------------------------- |
| `colorPrimary`     | `#1B5EBF` | `#1A6FD4` | 品牌藍微調，介於現有與 iOS `#007AFF` 之間的折衷值 |
| `colorSuccess`     | `#52c41a` | `#34C759` | iOS System Green                                  |
| `colorWarning`     | `#faad14` | `#FF9500` | iOS System Orange                                 |
| `colorError`       | `#ff4d4f` | `#FF3B30` | iOS System Red                                    |
| `colorInfo`        | `#1677ff` | `#5856D6` | iOS System Indigo（區別於 primary）               |
| `colorBgLayout`    | Antd 預設 | `#F2F2F7` | iOS systemGroupedBackground                       |
| `colorBgContainer` | Antd 預設 | `#FFFFFF` | iOS secondarySystemGroupedBackground              |
| `colorBorder`      | Antd 預設 | `#C6C6C8` | iOS separator                                     |
| `colorTextBase`    | Antd 預設 | `#000000` | iOS label                                         |

#### Dark Mode Seed Overrides

切換為 `darkAlgorithm` 時，Antd 會自動從 seed tokens 推導 dark 色階。僅針對少量值做覆寫：

| Token          | Dark 覆寫值 | 說明                                       |
| -------------- | ----------- | ------------------------------------------ |
| `colorPrimary` | `#2E88EE`   | Dark mode 略亮版本，確保在深色背景上可讀性 |

### 3.3 視覺風格（Global Tokens）

#### 圓角（Border Radius）

iOS 使用較大的圓角，調整 Antd global tokens：

| Token            | 現值      | 新值 | 說明                   |
| ---------------- | --------- | ---- | ---------------------- |
| `borderRadius`   | `6`       | `10` | 卡片、Modal 等主要容器 |
| `borderRadiusLG` | Antd 預設 | `14` | 大型容器               |
| `borderRadiusSM` | Antd 預設 | `8`  | 按鈕、輸入框           |

#### 字型

| Token              | 現值                 | 新值  | 說明                |
| ------------------ | -------------------- | ----- | ------------------- |
| `fontFamily`       | `-apple-system, ...` | 不變  | 已包含 iOS 系統字體 |
| `fontSize`         | `14`                 | 不變  |                     |
| `fontWeightStrong` | Antd 預設            | `600` | iOS 偏好 semibold   |

### 3.4 Component Token 調整

| 元件   | 調整內容              | 現值 → 新值                                                                                        |
| ------ | --------------------- | -------------------------------------------------------------------------------------------------- |
| Layout | Sidebar / Header 背景 | `siderBg: '#001529'`, `headerBg: '#001529'` → 移除（跟隨主題 algorithm）                           |
| Table  | 表頭背景              | `headerBg: '#F5F7FA'` → 移除（使用 algorithm 推導的 `colorFillAlter`）                             |
| Button | 圓角                  | `borderRadius: 6` → 移除（繼承 global `borderRadius: 10`）                                         |
| Card   | 陰影                  | Antd 預設 → iOS 風格細膩陰影 `boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)'` |
| Modal  | 陰影                  | Antd 預設 → iOS 風格陰影                                                                           |
| Menu   | 主題                  | `theme="dark"` hardcode → 移除，跟隨主題                                                           |

### 3.5 Theme 切換架構

#### ThemeContext

新增 `ThemeContext`（`client/src/theme/context/ThemeContext.tsx`）管理主題狀態：

- **狀態**：`mode: 'light' | 'dark' | 'system'`
- **系統偵測**：監聽 `prefers-color-scheme` media query（當 `mode = 'system'` 時自動切換）
- **持久化**：`localStorage` key `theme-mode`
- **方法**：`toggleTheme()`（三態循環）、`setTheme(mode)`
- **預設值**：`'system'`

#### App.tsx 整合

```
ThemeProvider
  └─ ConfigProvider theme={getTheme(resolvedMode)}
       └─ AuthProvider
            └─ RouterProvider
```

`getTheme(mode: 'light' | 'dark')` 根據 resolved mode（system 解析後的實際 light / dark）回傳對應的 `ThemeConfig`：

- Light：`{ algorithm: theme.defaultAlgorithm, token: lightSeedTokens, components: ... }`
- Dark：`{ algorithm: theme.darkAlgorithm, token: { ...lightSeedTokens, ...darkSeedOverrides }, components: ... }`

#### 切換 UI

AdminLayout Header 右側加入主題切換按鈕：

- 圖標：Light 時顯示太陽（`SunOutlined`）、Dark 時顯示月亮（`MoonOutlined`）、System 時顯示桌面（`DesktopOutlined`）
- 點擊行為：light → dark → system → light 循環

### 3.6 AdminLayout 適配

Sidebar 風格改為跟隨主題：

| 狀態       | Sidebar 外觀                                           |
| ---------- | ------------------------------------------------------ |
| Light mode | 淺色背景、深色文字（跟隨 Antd Layout 預設 light 配色） |
| Dark mode  | 深色背景、淺色文字（跟隨 Antd Layout 預設 dark 配色）  |

**需修改項目**：

- 移除 `layout.ts` 的 hardcoded `siderBg: '#001529'`、`headerBg: '#001529'`
- 移除 `<Menu theme="dark">` 的 hardcode，改為根據 theme mode 動態設定或不指定（跟隨 ConfigProvider）
- 調整 `createStyles` 中依賴深色背景的 token（如 `colorTextLightSolid`），改用語義化 token

---

## 4. 高層設計

### 4.1 檔案結構調整

```
client/src/theme/
├── index.ts              → 重構：匯出 getTheme(mode: 'light' | 'dark') 函式
├── tokens/
│   ├── colors.ts         → 重構：匯出 lightSeedTokens + darkSeedOverrides
│   ├── typography.ts     → 修改：新增 fontWeightStrong
│   ├── spacing.ts        → 修改：更新 borderRadius 值
│   └── index.ts          → 不變
├── components/
│   ├── button.ts         → 修改：移除 hardcoded borderRadius
│   ├── table.ts          → 修改：移除 hardcoded #F5F7FA
│   ├── form.ts           → 不變
│   ├── layout.ts         → 修改：移除 hardcoded #001529
│   ├── card.ts           → 新增：iOS 風格 shadow
│   ├── modal.ts          → 新增：iOS 風格 shadow
│   └── index.ts          → 修改：新增 cardTheme, modalTheme 匯出
└── context/
    └── ThemeContext.tsx   → 新增：theme mode 管理 + useTheme hook
```

### 4.2 影響範圍

**需修改的現有檔案**：

| 路徑                                    | 變更內容                                                       |
| --------------------------------------- | -------------------------------------------------------------- |
| `client/src/App.tsx`                    | 加入 ThemeProvider 包裹、匯入 getTheme + useTheme              |
| `client/src/layouts/AdminLayout.tsx`    | 移除 hardcoded dark sidebar、加入主題切換按鈕、調整 token 使用 |
| `client/src/theme/index.ts`             | 重構為 `getTheme(mode)` 函式，引入 algorithm                   |
| `client/src/theme/tokens/colors.ts`     | iOS 風格 seed tokens + dark overrides                          |
| `client/src/theme/tokens/spacing.ts`    | 更新 borderRadius 值                                           |
| `client/src/theme/tokens/typography.ts` | 新增 fontWeightStrong                                          |
| `client/src/theme/components/button.ts` | 移除 hardcoded borderRadius                                    |
| `client/src/theme/components/layout.ts` | 移除 hardcoded 色值                                            |
| `client/src/theme/components/table.ts`  | 移除 hardcoded 色值                                            |
| `client/src/theme/components/index.ts`  | 新增 cardTheme, modalTheme 匯出                                |

**需新增的檔案**：

| 路徑                                        | 說明                                               |
| ------------------------------------------- | -------------------------------------------------- |
| `client/src/theme/context/ThemeContext.tsx` | Theme mode 管理 Context + Provider + useTheme hook |
| `client/src/theme/components/card.ts`       | Card component token（iOS 風格 shadow）            |
| `client/src/theme/components/modal.ts`      | Modal component token（iOS 風格 shadow）           |

---

## 5. 詳細設計

### 5.1 ThemeContext

**檔案**：`client/src/theme/context/ThemeContext.tsx`

```ts
type TThemeMode = 'light' | 'dark' | 'system';

interface IThemeContext {
  mode: TThemeMode; // 使用者選擇的 mode
  resolvedMode: 'light' | 'dark'; // 實際生效的 mode（system 解析後）
  setTheme: (mode: TThemeMode) => void;
  toggleTheme: () => void;
}
```

**實作要點**：

- `useEffect` 監聽 `window.matchMedia('(prefers-color-scheme: dark)')` 的 `change` 事件
- 初始化時從 `localStorage.getItem('theme-mode')` 讀取，無值時預設 `'system'`
- `setTheme()` 同時更新 state 和 `localStorage`
- `toggleTheme()` 循環順序：`light → dark → system → light`
- 在 `<html>` 元素上設定 `data-theme` attribute（供 CSS 變數或其他非 Antd 元素使用）

### 5.2 getTheme 函式

**檔案**：`client/src/theme/index.ts`

```ts
import { theme as antdTheme, type ThemeConfig } from 'antd';
import { lightSeedTokens, darkSeedOverrides } from './tokens';
import { componentTokens } from './components';

export function getTheme(mode: 'light' | 'dark'): ThemeConfig {
  const isDark = mode === 'dark';

  return {
    cssVar: {},
    hashed: false,
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: isDark ? { ...lightSeedTokens, ...darkSeedOverrides } : lightSeedTokens,
    components: componentTokens,
  };
}
```

### 5.3 colors.ts 重構

**檔案**：`client/src/theme/tokens/colors.ts`

```ts
/**
 * iOS 風格 Seed Tokens — Light Mode
 * Antd 演算法會自動推導完整色彩系統
 */
export const lightSeedTokens = {
  colorPrimary: '#1A6FD4',
  colorSuccess: '#34C759',
  colorWarning: '#FF9500',
  colorError: '#FF3B30',
  colorInfo: '#5856D6',
  colorBgLayout: '#F2F2F7',
  colorBgContainer: '#FFFFFF',
  colorBorder: '#C6C6C8',
  colorTextBase: '#000000',
};

/**
 * Dark Mode 覆寫值
 * 僅覆寫 darkAlgorithm 自動推導不夠精確的值
 */
export const darkSeedOverrides = {
  colorPrimary: '#2E88EE',
};
```

### 5.4 spacing.ts 更新

```ts
export const spacingTokens = {
  borderRadius: 10,
  borderRadiusLG: 14,
  borderRadiusSM: 8,
  controlHeight: 36,
};
```

### 5.5 typography.ts 更新

```ts
export const typographyTokens = {
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans TC', sans-serif",
  fontSize: 14,
  fontWeightStrong: 600,
};
```

### 5.6 Component Tokens

**layout.ts** — 移除所有 hardcoded 色值：

```ts
export const layoutTheme: TLayoutToken = {};
```

> Layout 的 sidebar / header 背景將完全由 Antd algorithm 根據 light / dark mode 自動推導。

**table.ts** — 移除 hardcoded 色值：

```ts
export const tableTheme: TTableToken = {};
```

**button.ts** — 移除 hardcoded borderRadius（繼承 global token）：

```ts
export const buttonTheme: TButtonToken = {};
```

**card.ts**（新增）：

```ts
import type { ThemeConfig } from 'antd';

type TCardToken = NonNullable<NonNullable<ThemeConfig['components']>['Card']>;

export const cardTheme: TCardToken = {
  boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
};
```

**modal.ts**（新增）：

```ts
import type { ThemeConfig } from 'antd';

type TModalToken = NonNullable<NonNullable<ThemeConfig['components']>['Modal']>;

export const modalTheme: TModalToken = {
  boxShadow: '0 4px 16px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)',
};
```

### 5.7 App.tsx 整合

```tsx
import { ConfigProvider } from 'antd';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider, useTheme } from './theme/context/ThemeContext';
import { getTheme } from './theme';
import router from './router';

const AppContent = () => {
  const { resolvedMode } = useTheme();

  return (
    <ConfigProvider theme={getTheme(resolvedMode)}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ConfigProvider>
  );
};

const App = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;
```

> `ThemeProvider` 必須在 `ConfigProvider` 外層，因為 `useTheme()` 需要存取 ThemeContext 來決定 `resolvedMode`。透過 `AppContent` 內部元件呼叫 `useTheme()` 取得 `resolvedMode` 後傳入 `getTheme()`。

### 5.8 AdminLayout 適配

**主要變更**：

1. 移除 `<Menu theme="dark">`，改為不指定 theme（跟隨 ConfigProvider）
2. Header 右側加入主題切換按鈕
3. `createStyles` 中的 `colorTextLightSolid` 改為 `token.colorText`（不再假定深色背景）

**主題切換按鈕邏輯**：

```tsx
import { SunOutlined, MoonOutlined, DesktopOutlined } from '@ant-design/icons';
import { useTheme } from '../theme/context/ThemeContext';

// 在 AdminLayout 中
const { mode, toggleTheme } = useTheme();

const themeIcon = {
  light: <SunOutlined />,
  dark: <MoonOutlined />,
  system: <DesktopOutlined />,
};

// Header 中
<Button type="text" icon={themeIcon[mode]} onClick={toggleTheme} />;
```

---

## 6. 測試計畫

測試策略沿用 [rfc_00 §6](rfc_00-project_tech_stack.md)。

### 6.1 驗證項目

| 項目                        | 驗證方式                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------- |
| Light mode 配色正確         | `npm run dev` 啟動後視覺檢查                                                           |
| Dark mode 配色正確          | 手動切換至 dark mode 視覺檢查                                                          |
| System mode 跟隨 OS         | 更改 OS 暗色模式設定，確認自動切換                                                     |
| 切換按鈕三態循環            | 連續點擊切換按鈕，確認 light → dark → system → light                                   |
| localStorage 持久化         | 設定主題後重新整理頁面，確認主題保持                                                   |
| Sidebar 跟隨主題            | Light 時淺色 sidebar、Dark 時深色 sidebar                                              |
| 無 hardcoded 色值殘留       | 全專案搜尋 `#001529`、`#F5F7FA` 確認已清除                                             |
| 所有頁面 Dark mode 顯示正常 | 逐頁檢查：Login、Chat、Blacklist、Chatroom、OperationLog、NicknameReview、ReportReview |
| 既有測試不受影響            | `npm test` 全部通過                                                                    |

### 6.2 測試檔案

| 層級      | 測試檔案                | 測試目標                                                 |
| --------- | ----------------------- | -------------------------------------------------------- |
| Component | `ThemeContext.test.tsx` | ThemeProvider 三態切換、localStorage 持久化、system 偵測 |
| Component | `AdminLayout.test.tsx`  | 主題切換按鈕渲染與點擊行為                               |

---

## 7. 風險與緩解

| 風險                                     | 影響                                       | 緩解方式                                                 |
| ---------------------------------------- | ------------------------------------------ | -------------------------------------------------------- |
| darkAlgorithm 推導的色值不符 iOS 預期    | 部分元件在 dark mode 的配色不夠理想        | 少量 dark mode 下的 component token 覆寫；視覺檢查後微調 |
| Sidebar 跟隨主題後 Light mode 辨識度下降 | 淺色 sidebar 與 content 區域視覺分隔不明顯 | 透過 `colorBgLayout` / `colorBorderSecondary` 增加分隔感 |
| 現有 createStyles 中隱式依賴 light mode  | Dark mode 下文字或背景不可讀               | Task 7.5 全站頁面逐頁驗證                                |
| Card shadow 在 dark mode 下不明顯        | 卡片缺乏立體感                             | Dark mode 可微調 shadow opacity 或使用 border 輔助       |

---

## 8. 完成標準

- [ ] `client/src/theme/tokens/colors.ts` 包含 `lightSeedTokens` + `darkSeedOverrides`，無 hardcoded hex 殘留
- [ ] `client/src/theme/index.ts` 匯出 `getTheme(mode)` 函式，支援 light / dark 兩種 algorithm
- [ ] `client/src/theme/context/ThemeContext.tsx` 實作 light / dark / system 三態切換 + localStorage 持久化
- [ ] `client/src/App.tsx` 正確整合 ThemeProvider + 動態 ConfigProvider
- [ ] AdminLayout sidebar 跟隨主題（Light 淺色、Dark 深色），Header 有切換按鈕
- [ ] `layout.ts`、`table.ts`、`button.ts` 不含 hardcoded hex 色值
- [ ] 新增 `card.ts`、`modal.ts` component token（iOS 風格 shadow）
- [ ] 所有頁面在 Light / Dark mode 下顯示正常
- [ ] `npm test` 全部通過
- [ ] ThemeContext 測試涵蓋三態切換與 localStorage 持久化
