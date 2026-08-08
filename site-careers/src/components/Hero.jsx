import React from 'react';
import { useLang } from '../i18n/LangContext';
import { SITE } from '../lib/config';
import { IconArrow } from './Icons';

export default function Hero() {
  const { t } = useLang();
  const go = (href) => document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
  const appHref = SITE.appStore || SITE.playStore || '#app';

  return (
    <section className="hero" id="hero">
      <div className="hero__glow" />
      <div className="container hero__inner">
        <h1>{t('hero.title')} <span className="accent">{t('hero.accent')}</span></h1>
        <p className="hero__lead">{t('hero.sub')}</p>
        <div className="hero__cta">
          <a className="btn btn--gold btn--lg" href={appHref} onClick={appHref === '#app' ? (e) => { e.preventDefault(); go('#app'); } : undefined}>
            {t('hero.cta1')} <IconArrow size={18} />
          </a>
          <button className="btn btn--ghost-light btn--lg" onClick={() => go('#offer')}>{t('hero.cta2')}</button>
        </div>
      </div>
      <div className="hero__scroll"><span className="line" /></div>
    </section>
  );
}
