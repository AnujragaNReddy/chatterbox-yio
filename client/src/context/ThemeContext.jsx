import { createContext, useContext, useEffect, useState } from 'react';

export const THEMES = [
  { id: 'classic', label: 'Classic', description: 'The familiar green', swatch: ['#00a884', '#d9fdd3', '#efeae2'] },
  { id: 'midnight', label: 'Midnight', description: 'Dark & OLED-friendly', swatch: ['#00a884', '#005c4b', '#0b141a'] },
  { id: 'aurora', label: 'Aurora', description: 'Glass & gradients', swatch: ['#c084fc', '#ec4899', '#1a1233'] },
  { id: 'retro', label: 'Retro', description: 'Y2K messenger blue', swatch: ['#2f6fd1', '#cfe8ff', '#dbeafe'] },
  { id: 'neon', label: 'Neon', description: 'Cyberpunk glow', swatch: ['#00f5d4', '#ff2bd6', '#05050a'] },
  { id: 'sunset', label: 'Sunset', description: 'Warm gradient dusk', swatch: ['#ff8a5b', '#ff5e7e', '#2b1418'] },
];

const ThemeContext = createContext(null);
const STORAGE_KEY = 'chatterbox.theme';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem(STORAGE_KEY) || 'classic');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
