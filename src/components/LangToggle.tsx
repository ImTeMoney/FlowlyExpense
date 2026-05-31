import { useState, useRef, useEffect } from 'react';
import { useLang } from '../context/LanguageContext';
import { FlagIL, FlagUS } from './Flags';

interface Props {
  variant?: 'floating' | 'inline';
}

export default function LangToggle({ variant = 'inline' }: Props) {
  const { lang, toggleLang } = useLang();
  const he = lang === 'he';
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  return (
    <div ref={ref} className={variant === 'floating' ? 'ob-lang-wrap' : 'dash-lang-wrap'}>
      <button className="lang-toggle-pill" onClick={() => setOpen(v => !v)}>
        {he ? <FlagIL size={22}/> : <FlagUS size={22}/>}
      </button>
      {open && (
        <div className="lang-dropdown">
          <button
            className={`lang-option${!he ? ' active' : ''}`}
            onClick={() => { if (he) toggleLang(); setOpen(false); }}
          >
            <FlagUS size={20}/><span>English</span>
          </button>
          <button
            className={`lang-option${he ? ' active' : ''}`}
            onClick={() => { if (!he) toggleLang(); setOpen(false); }}
          >
            <FlagIL size={20}/><span>עברית</span>
          </button>
        </div>
      )}
    </div>
  );
}
