import React, { useState } from 'react';
import { useLang } from '../i18n/LangContext';
import Reveal from './Reveal';

const QA = [
  ['faq.q1', 'faq.a1'], ['faq.q2', 'faq.a2'], ['faq.q3', 'faq.a3'],
  ['faq.q4', 'faq.a4'], ['faq.q5', 'faq.a5'], ['faq.q6', 'faq.a6'],
];

export default function Faq() {
  const { t } = useLang();
  const [open, setOpen] = useState(0);

  return (
    <section className="section section--paper" id="faq">
      <div className="container">
        <Reveal className="section-head center">
          <p className="kicker">{t('faq.kicker')}</p>
          <h2 className="section-title">{t('faq.title')}</h2>
        </Reveal>

        <div className="faq-list">
          {QA.map(([q, a], idx) => (
            <Reveal key={q} delay={(idx % 4) + 1} className={`faq-item${open === idx ? ' open' : ''}`}>
              <button className="faq-q" onClick={() => setOpen(open === idx ? -1 : idx)} aria-expanded={open === idx}>
                <span>{t(q)}</span>
                <span className="ico">+</span>
              </button>
              <div className="faq-a"><p>{t(a)}</p></div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
