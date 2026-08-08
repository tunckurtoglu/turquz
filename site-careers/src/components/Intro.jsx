import React from 'react';
import { useLang } from '../i18n/LangContext';
import Reveal from './Reveal';

export default function Intro() {
  const { t } = useLang();
  return (
    <section className="section section--paper">
      <div className="container">
        <Reveal className="intro-wrap">
          <p className="kicker">{t('intro.kicker')}</p>
          <h2 className="intro-title">{t('intro.title')}</h2>
          <p className="intro-text">{t('intro.text')}</p>
        </Reveal>
      </div>
    </section>
  );
}
