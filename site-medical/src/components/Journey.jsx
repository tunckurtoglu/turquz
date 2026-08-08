import React from 'react';
import { useLang } from '../i18n/LangContext';
import Reveal from './Reveal';

const STEP_KEYS = ['s1', 's2', 's3', 's4'];

/** @param {'home'|'dental'|'eye'} variant */
export default function Journey({ variant = 'home' }) {
  const { t } = useLang();
  const head = variant === 'home' ? 'journey' : `${variant}.journey`;
  // Adımlar hub ile ortak; diş/göz sadece başlık/lead özelleşir
  const stepBase = 'journey';

  return (
    <section className="section section--card" id="journey">
      <div className="container">
        <Reveal className="section-head center">
          <p className="kicker">{t(`${head}.kicker`)}</p>
          <h2 className="section-title">{t(`${head}.title`)}</h2>
          <p className="section-lead">{t(`${head}.lead`)}</p>
        </Reveal>

        <div className="journey-grid">
          {STEP_KEYS.map((s, i) => (
            <Reveal key={s} delay={(i % 4) + 1} className="journey-card">
              <span className="journey-card__n">{String(i + 1).padStart(2, '0')}</span>
              <h3>{t(`${stepBase}.${s}.t`)}</h3>
              <p>{t(`${stepBase}.${s}.d`)}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
