import React from 'react';
import { useLang } from '../i18n/LangContext';
import { SITE } from '../lib/config';
import { Link } from '../lib/router';
import ConsultLink from './ConsultLink';

export default function Footer() {
  const { t } = useLang();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__top">
          <div className="footer__brand">
            <img src="/brand/turquz-logo-trim.png" alt={SITE.brand} />
            <p>{t('foot.tagline')}</p>
          </div>
          <div className="footer__links">
            <Link to="/">{t('nav.healthHome')}</Link>
            <Link to="/dis">{t('nav.dental')}</Link>
            <Link to="/goz">{t('nav.eye')}</Link>
            <ConsultLink>{t('foot.contact')}</ConsultLink>
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
