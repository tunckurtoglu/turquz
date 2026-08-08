import React, { useEffect, useState } from 'react';
import { useLang } from '../i18n/LangContext';
import { SITE } from '../lib/config';
import { Link, useRouter } from '../lib/router';
import LanguageSwitcher from './LanguageSwitcher';
import ConsultLink from './ConsultLink';

export default function Header() {
  const { t } = useLang();
  const { path, navigate } = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [onHero, setOnHero] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const isDental = path === '/dis' || path === '/dental' || path.startsWith('/dis/') || path.startsWith('/dental/');
  const isEye = path === '/goz' || path === '/eye' || path.startsWith('/goz/') || path.startsWith('/eye/');
  const isHub = !isDental && !isEye;
  const treatDetail = /\/(dis|dental|goz|eye)\/[^/]+$/.test(path);
  const parentPath = isDental ? '/dis' : isEye ? '/goz' : '/';

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
      const hero = document.getElementById('hero');
      if (!hero) {
        setOnHero(false);
        return;
      }
      const h = hero.offsetHeight - 90;
      setOnHero(window.scrollY < h);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [path]);

  useEffect(() => { setMenuOpen(false); }, [path]);

  const goHash = (href) => {
    setMenuOpen(false);
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
  };

  const goTreatments = () => {
    setMenuOpen(false);
    navigate(parentPath);
    window.setTimeout(() => {
      document.querySelector('#treatments')?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  };

  const nav = isHub
    ? [
        [t('nav.services'), '#services'],
        [t('nav.journey'), '#journey'],
        [t('nav.why'), '#why'],
        [t('nav.faq'), '#faq'],
      ]
    : treatDetail
      ? [[t('nav.treatments'), 'treatments']]
      : [
          [t('nav.treatments'), '#treatments'],
          [t('nav.journey'), '#journey'],
          [t('nav.why'), '#why'],
          [t('nav.faq'), '#faq'],
        ];

  const renderNavItem = (label, href) => {
    if (href === 'treatments') {
      return (
        <a key={href} href={parentPath} onClick={(e) => { e.preventDefault(); goTreatments(); }}>{label}</a>
      );
    }
    if (href.startsWith('#')) {
      return (
        <a key={href} href={href} onClick={(e) => { e.preventDefault(); goHash(href); }}>{label}</a>
      );
    }
    return <Link key={href} to={href}>{label}</Link>;
  };

  return (
    <header className={`header${scrolled ? ' scrolled' : ''}${onHero ? ' on-hero' : ''}`}>
      <div className="container header__inner">
        <Link className="brand" to="/" aria-label={SITE.brand}>
          <img src="/brand/turquz-logo-trim.png" alt={SITE.brand} />
          <span className="brand__tag">{t('brand.vertical')}</span>
        </Link>

        <nav className="nav">
          {!isHub && (
            <Link to="/">{t('nav.healthHome')}</Link>
          )}
          {isDental && <span className="nav__pill">{t('nav.dental')}</span>}
          {isEye && <span className="nav__pill">{t('nav.eye')}</span>}
          {nav.map(([label, href]) => renderNavItem(label, href))}
          <a href={SITE.mainSiteUrl}>{t('nav.main')} ↗</a>
        </nav>

        <div className="header__cta">
          <ConsultLink className="btn btn--gold">{t('nav.consult')}</ConsultLink>
          <LanguageSwitcher />
          <button className={`burger${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">
            <span /><span /><span />
          </button>
        </div>
      </div>

      <div className={`mobile-nav${menuOpen ? ' open' : ''}`}>
        {!isHub && (
          <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>{t('nav.healthHome')}</a>
        )}
        {nav.map(([label, href]) => renderNavItem(label, href))}
        <ConsultLink onClick={() => setMenuOpen(false)}>{t('nav.consult')}</ConsultLink>
        <a href={SITE.mainSiteUrl}>{t('nav.main')} ↗</a>
      </div>
    </header>
  );
}
