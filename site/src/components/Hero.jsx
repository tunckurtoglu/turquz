import React from 'react';
import { useLang } from '../i18n/LangContext';
import { HERO_IMAGE } from '../lib/hero';
import { IconArrow } from './Icons';

export default function Hero() {
  const { t } = useLang();
  const go = (href) => document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });

  // Görsel varsa arka plana koy; yoksa CSS gradient (styles.css .hero) devrede.
  const bgStyle = HERO_IMAGE
    ? { backgroundImage: `linear-gradient(180deg, rgba(15,22,32,0.62) 0%, rgba(15,22,32,0.78) 100%), url(${HERO_IMAGE})` }
    : undefined;

  return (
    <section className={`hero${HERO_IMAGE ? ' hero--img' : ''}`} id="hero" style={bgStyle}>
      {!HERO_IMAGE && <><div className="hero__glow" /><div className="hero__grain" /></>}
      <div className="container hero__inner">
        <h1>
          {t('hero.title')} <span className="accent">{t('hero.accent')}</span>
        </h1>
        <p className="hero__lead">{t('hero.sub')}</p>
        <div className="hero__cta">
          <button className="btn btn--gold btn--lg" onClick={() => go('#services')}>
            {t('hero.cta1')} <IconArrow size={18} />
          </button>
          <button className="btn btn--ghost-light btn--lg" onClick={() => go('#contact')}>
            {t('hero.cta2')}
          </button>
        </div>
      </div>
      <div className="hero__scroll"><span className="line" /></div>
    </section>
  );
}
