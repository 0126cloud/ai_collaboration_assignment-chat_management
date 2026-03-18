import type { ThemeConfig } from 'antd';

type TModalToken = NonNullable<NonNullable<ThemeConfig['components']>['Modal']>;

export const modalTheme: TModalToken = {
  boxShadow: '0 4px 16px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)',
};
