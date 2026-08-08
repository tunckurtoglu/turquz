import React, { useEffect, useState } from 'react';
import { useLang } from '../i18n/LangContext';
import { SITE } from '../lib/config';
import LanguageSwitcher from './LanguageSwitcher';

export default function Header() {
  const { t } = useLang();
  const [scrolled, setScrolled] = useState(false);
  const [onHero, setOnHero] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
      const hero = document.getElementById('hero');
      const h = hero ? hero.offsetHeight - 90 : 500;
      setOnHero(window.scrollY < h);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const go = (href) => { setMenuOpen(false); document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' }); };

  const nav = [
    [t('nav.offer'), '#offer'],
    [t('nav.partners'), '#partners'],
    [t('nav.gallery'), '#gallery'],
    [t('nav.faq'), '#faq'],
    [t('nav.app'), '#app'],
  ];

  return (
    <header className={`header${scrolled ? ' scrolled' : ''}${onHero ? ' on-hero' : ''}`}>
      <div className="container header__inner">
        <a className="brand" href={SITE.mainSiteUrl} aria-label={SITE.brand}>
          <img src="/brand/turquz-logo-trim.png" alt={SITE.brand} />
          <span className="brand__tag">{t('brand.vertical')}</span>
        </a>

        <nav className="nav">
          {nav.map(([label, href]) => (
            <a key={href} href={href} onClick={(e) => { e.preventDefault(); go(href); }}>{label}</a>
          ))}
          <a href={SITE.mainSiteUrl}>{t('nav.main')} ↗</a>
        </nav>

        <div className="header__cta">
          <LanguageSwitcher />
          {SITE.agencyPanelUrl ? (
            <a className="btn btn--gold btn--sm header__panel" href={SITE.agencyPanelUrl} target="_blank" rel="noopener noreferrer">
              {t('partners.agency.cta')}
            </a>
          ) : null}
          <button className={`burger${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">
            <span /><span /><span />
          </button>
        </div>
      </div>

      <div className={`mobile-nav${menuOpen ? ' open' : ''}`}>
        {nav.map(([label, href]) => (
          <a key={href} href={href} onClick={(e) => { e.preventDefault(); go(href); }}>{label}</a>
        ))}
        {SITE.agencyPanelUrl ? (
          <a href={SITE.agencyPanelUrl} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>
            {t('partners.agency.title')}
          </a>
        ) : null}
        <a href={SITE.mainSiteUrl}>{t('nav.main')} ↗</a>
      </div>
    </header>
  );
}
