import { useState, useEffect } from 'react';

type Theme = 'dark' | 'light';

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme | null;
    return saved ?? 'light';
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Apply on first render
  useEffect(() => { applyTheme(theme); }, []);

  function toggle() {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  }

  return [theme, toggle];
}
