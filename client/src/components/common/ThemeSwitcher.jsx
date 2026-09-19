import { useState, useRef, useEffect } from 'react';
import { Palette, Check } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext.jsx';
import './ThemeSwitcher.css';

export default function ThemeSwitcher() {
  const { theme, setTheme, themes } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div className="theme-switcher" ref={ref}>
      <button className="icon-btn" title="Change theme" onClick={() => setOpen((v) => !v)}>
        <Palette size={20} />
      </button>
      {open && (
        <div className="theme-panel">
          <div className="theme-panel-title">Choose a theme</div>
          {themes.map((t) => (
            <button key={t.id} className="theme-option" onClick={() => setTheme(t.id)}>
              <span className="theme-swatch">
                {t.swatch.map((c, i) => (
                  <span key={i} style={{ background: c }} />
                ))}
              </span>
              <span className="theme-option-text">
                <span className="theme-option-label">{t.label}</span>
                <span className="theme-option-desc">{t.description}</span>
              </span>
              {theme === t.id && <Check size={16} className="theme-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
