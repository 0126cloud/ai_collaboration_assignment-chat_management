import type { ThemeConfig } from 'antd';

type TButtonToken = NonNullable<NonNullable<ThemeConfig['components']>['Button']>;

export const buttonTheme: TButtonToken = {};
