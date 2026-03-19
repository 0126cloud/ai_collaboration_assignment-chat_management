import type { ThemeConfig } from 'antd';

type TFormToken = NonNullable<NonNullable<ThemeConfig['components']>['Form']>;
type TInputToken = NonNullable<NonNullable<ThemeConfig['components']>['Input']>;

export const formTheme: TFormToken = {
  itemMarginBottom: 24,
};

export const inputTheme: TInputToken = {};
