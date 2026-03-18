import type { ThemeConfig } from 'antd';

type TLayoutToken = NonNullable<NonNullable<ThemeConfig['components']>['Layout']>;

export const layoutTheme: TLayoutToken = {};
