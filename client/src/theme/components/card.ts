import type { ThemeConfig } from 'antd';

type TCardToken = NonNullable<NonNullable<ThemeConfig['components']>['Card']>;

export const cardTheme: TCardToken = {
  boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
};
