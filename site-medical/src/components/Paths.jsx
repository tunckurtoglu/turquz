import React from 'react';
import { useLang } from '../i18n/LangContext';
import { Link } from '../lib/router';
import Reveal from './Reveal';
import { IconArrow, IconEye, IconTooth } from './Icons';

const CARDS = [
  {
    to: '/dis',
    ico: IconTooth,
    kicker: 'paths.dental.kicker',
    title: 'paths.dental.title',
    text: 'paths.dental.text',
    cta: 'paths.dental.cta',
    tone: 'dental',
  },
  {
    to: '/goz',
    ico: IconEye,
    kicker: 'paths.eye.kicker',
    title: 'paths.eye.title',
    text: 'paths.eye.text',
    cta: 'paths.eye.cta',
    tone: 'eye',
  },
];

export default function Paths() {
  const { t } = useLang();

  return (
    <section className="section section--card" id="services">
      <div className="container">
        <Reveal className="section-head center">
          <p className="kicker">{t('paths.kicker')}</p>
          <h2 className="section-title">{t('paths.title')}</h2>
          <p className="section-lead">{t('paths.lead')}</p>
        </Reveal>

        <div className="path-grid">
          {CARDS.map((c, i) => {
            const Ico = c.ico;
            return (
              <Reveal key={c.to} delay={i + 1} className={`path-card path-card--${c.tone}`}>
                <Link to={c.to} className="path-card__link">
                  <span className="path-card__ico" aria-hidden="true">
                    <Ico size={28} />
                  </span>
                  <p className="path-card__kicker">{t(c.kicker)}</p>
                  <h3>{t(c.title)}</h3>
                  <p className="path-card__text">{t(c.text)}</p>
                  <span className="path-card__cta">
                    {t(c.cta)} <IconArrow size={18} />
                  </span>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
