import React from 'react';
import { useLang } from '../i18n/LangContext';
import { SITE } from '../lib/config';
import Reveal from './Reveal';
import { IconArrow } from './Icons';

// [anahtar (foto+ikon), durum] — yalnızca careers / medical / software aktif
const SERVICES = [
  ['careers', 'live'],
  ['medical', 'live'],
  ['software', 'live'],
  ['academy', 'soon'],
  ['tour', 'soon'],
  ['trade', 'soon'],
];

export default function Services() {
  const { t } = useLang();
  const go = (href) => document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section className="section section--paper svc-section" id="services">
      <div className="container">
        <Reveal className="section-head center">
          <p className="kicker">{t('svc.kicker')}</p>
          <h2 className="section-title">{t('svc.title')}</h2>
          <p className="section-lead">{t('svc.lead')}</p>
        </Reveal>

        <div className="svc-row">
          {SERVICES.map(([key, state], i) => (
            <Reveal key={key} delay={(i % 3) + 1} className={`svc-card${state === 'soon' ? ' is-soon' : ''}`}>
              {state === 'soon' && <span className="svc-card__tag soon">{t('svc.tag.soon')}</span>}
              <img className="svc-card__photo" src={`/brand/services/photos/${key}.jpg`} alt={t(`${key}.name`)} loading="lazy" />
              <div className="svc-card__body">
                <div className="svc-card__badge">
                  <img src={`/brand/services/${key}.png`} alt="" width="52" height="52" />
                </div>
                <h3 className="svc-card__name">{t(`${key}.name`)}</h3>
                <p>{t(`${key}.desc`)}</p>
                {SITE.serviceUrls?.[key] ? (
                  <a className="svc-card__more" href={SITE.serviceUrls[key]} target="_blank" rel="noopener">
                    {t('svc.more')} <IconArrow size={15} />
                  </a>
                ) : (
                  <button className="svc-card__more" onClick={() => go('#contact')}>
                    {t('svc.more')} <IconArrow size={15} />
                  </button>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
