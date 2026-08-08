import React from 'react';
import { useLang } from '../i18n/LangContext';
import { SITE } from '../lib/config';

const SERVICE_KEYS = ['careers', 'medical', 'software', 'academy', 'tour', 'trade'];

export default function Footer() {
  const { t } = useLang();
  const go = (href) => (e) => { e.preventDefault(); document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' }); };

  const quick = [
    [t('nav.home'), '#hero'],
    [t('nav.about'), '#about'],
    [t('foot.services'), '#services'],
    [t('foot.news'), '#'],
    [t('foot.faq'), '#'],
    [t('nav.contact'), '#contact'],
  ];
  const support = [
    [t('foot.request'), '#contact'],
    [t('foot.privacy'), SITE.privacyUrl || '#'],
    [t('foot.terms'), '#'],
    [t('foot.kvkk'), SITE.kvkkUrl || '#'],
  ];

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__top">
          <div className="footer__brand">
            <img src="/brand/turquz-logo-trim.png" alt={SITE.brand} style={{ height: 58, width: 'auto' }} />
            <p>{t('foot.tagline')}</p>
          </div>

          <div className="footer__col">
            <h4>{t('foot.quick')}</h4>
            {quick.map(([label, href], i) => (
              <a key={`q-${i}`} href={href} onClick={href.startsWith('#') && href !== '#' ? go(href) : undefined}>{label}</a>
            ))}
          </div>

          <div className="footer__col">
            <h4>{t('foot.services')}</h4>
            {SERVICE_KEYS.map((k) => (
              <a key={k} href="#services" onClick={go('#services')}>{t(`${k}.name`)}</a>
            ))}
          </div>

          <div className="footer__col">
            <h4>{t('foot.support')}</h4>
            {support.map(([label, href], i) => (
              <a key={`s-${i}`} href={href} onClick={href === '#contact' ? go('#contact') : undefined}>{label}</a>
            ))}
          </div>
        </div>

        <div className="footer__bottom">
          <span>© {SITE.copyrightYear} {SITE.brand}. {t('foot.rights')}</span>
          <div className="footer__social">
            {SITE.social?.instagram && <a href={SITE.social.instagram}>Instagram</a>}
            {SITE.social?.linkedin && <a href={SITE.social.linkedin}>LinkedIn</a>}
          </div>
        </div>
      </div>
    </footer>
  );
}
