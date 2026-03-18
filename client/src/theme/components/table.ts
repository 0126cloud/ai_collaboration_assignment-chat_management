import type { ThemeConfig } from 'antd';

type TTableToken = NonNullable<NonNullable<ThemeConfig['components']>['Table']>;

export const tableTheme: TTableToken = {};
