import { createContext, useContext, useEffect, useState } from 'react';

type TThemeMode = 'light' | 'dark' | 'system';

interface IThemeContext {
  mode: TThemeMode;
  resolvedMode: 'light' | 'dark';
  setTheme: (mode: TThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<IThemeContext | null>(null);

const STORAGE_KEY = 'theme-mode';
const TOGGLE_ORDER: TThemeMode[] = ['light', 'dark', 'system'];

function getSystemMode(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveMode(mode: TThemeMode): 'light' | 'dark' {
  return mode === 'system' ? getSystemMode() : mode;
}

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [mode, setMode] = useState<TThemeMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored as TThemeMode) ?? 'system';
  });

  const [resolvedMode, setResolvedMode] = useState<'light' | 'dark'>(() => resolveMode(mode));

  useEffect(() => {
    const resolved = resolveMode(mode);
    setResolvedMode(resolved);
    document.documentElement.setAttribute('data-theme', resolved);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const resolved = getSystemMode();
      setResolvedMode(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
    };

    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  const setTheme = (newMode: TThemeMode) => {
    setMode(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  };

  const toggleTheme = () => {
    const currentIndex = TOGGLE_ORDER.indexOf(mode);
    const nextMode = TOGGLE_ORDER[(currentIndex + 1) % TOGGLE_ORDER.length];
    setTheme(nextMode);
  };

  return (
    <ThemeContext.Provider value={{ mode, resolvedMode, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): IThemeContext => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
