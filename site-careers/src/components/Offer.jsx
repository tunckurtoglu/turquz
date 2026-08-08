import React from 'react';
import { useLang } from '../i18n/LangContext';
import Reveal from './Reveal';
import { IconArrow, IconCheck } from './Icons';

export default function Offer() {
  const { t } = useLang();
  const candLi = ['offer.cand.li1', 'offer.cand.li2', 'offer.cand.li3'];
  const empLi = ['offer.emp.li1', 'offer.emp.li2', 'offer.emp.li3'];
  const goPartners = (e) => {
    e.preventDefault();
    document.querySelector('#partners')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="section section--card" id="offer">
      <div className="container">
        <Reveal className="section-head center">
          <p className="kicker">{t('offer.kicker')}</p>
          <h2 className="section-title">{t('offer.title')}</h2>
          <p className="section-lead">{t('offer.lead')}</p>
        </Reveal>

        <div className="offer-grid">
          <Reveal delay={1} className="offer offer--cand">
            <h3>{t('offer.cand.title')}</h3>
            <ul>
              {candLi.map((k) => (
                <li key={k}><span className="dot"><IconCheck size={12} /></span>{t(k)}</li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={2} className="offer offer--emp">
            <h3>{t('offer.emp.title')}</h3>
            <ul>
              {empLi.map((k) => (
                <li key={k}><span className="dot"><IconCheck size={12} /></span>{t(k)}</li>
              ))}
            </ul>
            <a className="offer__link" href="#partners" onClick={goPartners}>
              {t('nav.partners')} <IconArrow size={15} />
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
