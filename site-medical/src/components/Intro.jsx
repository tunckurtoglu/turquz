import React from 'react';
import { useLang } from '../i18n/LangContext';
import Reveal from './Reveal';

/** @param {'home'|'dental'|'eye'} variant */
export default function Intro({ variant = 'home' }) {
  const { t } = useLang();
  const p = variant === 'home' ? 'intro' : `${variant}.intro`;
  return (
    <section className="section section--paper" id="intro">
      <div className="container">
        <Reveal className="intro-wrap">
          <p className="kicker">{t(`${p}.kicker`)}</p>
          <h2 className="intro-title">{t(`${p}.title`)}</h2>
          <p className="intro-text">{t(`${p}.text`)}</p>
        </Reveal>
      </div>
    </section>
  );
}
