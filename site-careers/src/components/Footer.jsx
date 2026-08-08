import React from 'react';
import { useLang } from '../i18n/LangContext';
import { SITE } from '../lib/config';

export default function Footer() {
  const { t } = useLang();
  const go = (href) => (e) => { e.preventDefault(); document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' }); };

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__top">
          <div className="footer__brand">
            <img src="/brand/turquz-logo-trim.png" alt={SITE.brand} />
            <p>{t('foot.tagline')}</p>
          </div>
          <div className="footer__links">
            <a href="#offer" onClick={go('#offer')}>{t('nav.offer')}</a>
            <a href="#partners" onClick={go('#partners')}>{t('nav.partners')}</a>
            <a href="#gallery" onClick={go('#gallery')}>{t('nav.gallery')}</a>
            <a href="#faq" onClick={go('#faq')}>{t('nav.faq')}</a>
            <a href="#app" onClick={go('#app')}>{t('nav.app')}</a>
            <a href={`mailto:${SITE.email}`}>{t('foot.contact')}</a>
            <a href={SITE.mainSiteUrl}>{t('nav.main')} ↗</a>
          </div>
        </div>
        <div className="footer__bottom">
          <span>© {SITE.copyrightYear} {SITE.brand}. {t('foot.rights')}</span>
          <span>{t('foot.disclaimer')}</span>
        </div>
      </div>
    </footer>
  );
}
