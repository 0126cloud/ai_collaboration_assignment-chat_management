import { theme as antdTheme, type ThemeConfig } from 'antd';
import { lightSeedTokens, darkSeedOverrides, typographyTokens, spacingTokens } from './tokens';
import {
  buttonTheme,
  tableTheme,
  formTheme,
  inputTheme,
  layoutTheme,
  cardTheme,
  modalTheme,
} from './components';

// Antd Layout.Sider/Header 的 component token 預設值是 #001529（不跟隨 algorithm），
// 需根據 mode 明確覆寫為語義色彩
const lightLayoutTheme = {
  siderBg: lightSeedTokens.colorBgContainer,
  headerBg: lightSeedTokens.colorBgContainer,
};

// Dark mode 只保留語義顏色覆寫，背景 / 邊框 / 文字由 darkAlgorithm 自動推導
// 若直接展開 lightSeedTokens（含 colorBgContainer: #FFFFFF），會覆蓋 darkAlgorithm 的推導結果
const darkSemanticTokens = {
  colorPrimary: darkSeedOverrides.colorPrimary,
  colorSuccess: lightSeedTokens.colorSuccess,
  colorWarning: lightSeedTokens.colorWarning,
  colorError: lightSeedTokens.colorError,
  colorInfo: lightSeedTokens.colorInfo,
};

export function getTheme(mode: 'light' | 'dark'): ThemeConfig {
  const isDark = mode === 'dark';

  return {
    cssVar: {},
    hashed: false,
    algorithm: isDark
      ? [antdTheme.darkAlgorithm, antdTheme.compactAlgorithm]
      : [antdTheme.defaultAlgorithm, antdTheme.compactAlgorithm],
    token: {
      ...(isDark ? darkSemanticTokens : lightSeedTokens),
      ...typographyTokens,
      ...spacingTokens,
    },
    components: {
      Button: buttonTheme,
      Table: tableTheme,
      Form: formTheme,
      Input: inputTheme,
      Layout: isDark ? layoutTheme : lightLayoutTheme,
      Card: cardTheme,
      Modal: modalTheme,
    },
  };
}
