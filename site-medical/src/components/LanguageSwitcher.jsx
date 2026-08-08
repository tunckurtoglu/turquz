import React, { useEffect, useRef, useState } from 'react';
import { useLang } from '../i18n/LangContext';
import { IconChevron } from './Icons';

export default function LanguageSwitcher() {
  const { lang, setLang, langs } = useLang();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const current = langs.find((l) => l.code === lang);

  return (
    <div className="lang" ref={wrapRef}>
      <button className="lang-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <span style={{ textTransform: 'uppercase' }}>{lang}</span>
        <IconChevron size={15} />
      </button>
      {open && (
        <div className="lang-menu" role="listbox">
          {langs.map((l) => (
            <button
              key={l.code}
              role="option"
              aria-selected={l.code === lang}
              onClick={() => { setLang(l.code); setOpen(false); }}
            >
              <span>{l.name}</span>
              {l.code === lang && <span className="tick">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
