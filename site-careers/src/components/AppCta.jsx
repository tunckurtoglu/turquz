import React from 'react';
import { useLang } from '../i18n/LangContext';
import { SITE } from '../lib/config';
import Reveal from './Reveal';
import { IconApple, IconPlay } from './Icons';

export default function AppCta() {
  const { t } = useLang();

  const StoreBtn = ({ href, Icon, line1, store }) => {
    const disabled = !href;
    return (
      <a className={`store-btn${disabled ? ' disabled' : ''}`} href={href || '#'} target={href ? '_blank' : undefined} rel="noopener">
        <span className="ic"><Icon size={28} /></span>
        <span className="lines">
          <span className="s1">{line1}</span>
          <span className="s2">{store}{disabled ? <span className="soon">{t('app.soon')}</span> : null}</span>
        </span>
      </a>
    );
  };

  return (
    <section className="section section--ink appcta" id="app">
      <div className="container appcta__inner">
        <Reveal>
          <p className="kicker" style={{ color: 'var(--gold-light)' }}>{t('app.kicker')}</p>
          <h2>{t('app.title')}</h2>
          <p>{t('app.text')}</p>
          <div className="store-row">
            <StoreBtn href={SITE.appStore} Icon={IconApple} line1="App Store" store="iOS" />
            <StoreBtn href={SITE.playStore} Icon={IconPlay} line1="Google Play" store="Android" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
