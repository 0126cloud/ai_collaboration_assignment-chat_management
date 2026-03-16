import type { ThemeConfig } from 'antd';
import { colorTokens, typographyTokens, spacingTokens } from './tokens';
import { buttonTheme, tableTheme, formTheme, inputTheme, layoutTheme } from './components';

const theme: ThemeConfig = {
  cssVar: {},
  hashed: false,
  token: {
    ...colorTokens,
    ...typographyTokens,
    ...spacingTokens,
  },
  components: {
    Button: buttonTheme,
    Table: tableTheme,
    Form: formTheme,
    Input: inputTheme,
    Layout: layoutTheme,
  },
};

export default theme;
