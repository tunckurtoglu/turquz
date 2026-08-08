import React, { useEffect, useState } from 'react';
import { useLang } from '../i18n/LangContext';
import { SITE } from '../lib/config';
import LanguageSwitcher from './LanguageSwitcher';

// Hizmet adları dile göre çevrilir.
const SERVICE_KEYS = ['careers', 'medical', 'software', 'academy', 'tour', 'trade'];

export default function Header() {
  const { t } = useLang();
  const [scrolled, setScrolled] = useState(false);
  const [onHero, setOnHero] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
      const hero = document.getElementById('hero');
      const h = hero ? hero.offsetHeight - 90 : 600;
      setOnHero(window.scrollY < h);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const go = (href) => { setMenuOpen(false); document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' }); };

  // [etiket, hedef]
  const nav = [
    [t('nav.home'), '#hero'],
    ...SERVICE_KEYS.map((k) => [t(`${k}.name`), '#services']),
    [t('nav.about'), '#about'],
    [t('nav.contact'), '#contact'],
  ];

  return (
    <header className={`header${scrolled ? ' scrolled' : ''}${onHero ? ' on-hero' : ''}`}>
      <div className="container header__inner">
        <a className="brand" href="#hero" onClick={(e) => { e.preventDefault(); go('#hero'); }} aria-label={SITE.brand}>
          <img src="/brand/turquz-logo-trim.png" alt={SITE.brand} />
        </a>

        <nav className="nav">
          {nav.map(([label, href], i) => (
            <a key={`${label}-${i}`} href={href} onClick={(e) => { e.preventDefault(); go(href); }}>{label}</a>
          ))}
        </nav>

        <div className="header__cta">
          <LanguageSwitcher />
          <button className={`burger${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">
            <span /><span /><span />
          </button>
        </div>
      </div>

      <div className={`mobile-nav${menuOpen ? ' open' : ''}`}>
        {nav.map(([label, href], i) => (
          <a key={`m-${label}-${i}`} href={href} onClick={(e) => { e.preventDefault(); go(href); }}>{label}</a>
        ))}
      </div>
    </header>
  );
}
