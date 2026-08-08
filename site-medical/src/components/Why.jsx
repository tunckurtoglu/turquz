import React from 'react';
import { useLang } from '../i18n/LangContext';
import Reveal from './Reveal';
import { IconHeadset, IconShield, IconGlobe } from './Icons';

const BLOCKS = [
  ['why.b1.t', 'why.b1.d', IconHeadset],
  ['why.b2.t', 'why.b2.d', IconGlobe],
  ['why.b3.t', 'why.b3.d', IconShield],
];

export default function Why() {
  const { t } = useLang();
  return (
    <section className="section section--ink" id="why">
      <div className="container">
        <Reveal className="section-head center">
          <p className="kicker" style={{ color: 'var(--gold-light)' }}>{t('why.kicker')}</p>
          <h2 className="section-title">{t('why.title')}</h2>
        </Reveal>

        <div className="why-grid">
          {BLOCKS.map(([title, desc, Icon], i) => (
            <Reveal key={title} delay={(i % 4) + 1} className="why-card">
              <div className="why-card__ico"><Icon size={26} /></div>
              <h3>{t(title)}</h3>
              <p>{t(desc)}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
