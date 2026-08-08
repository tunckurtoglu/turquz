import React from 'react';
import { useLang } from '../i18n/LangContext';
import { Link } from '../lib/router';
import { DENTAL_TREATMENTS, EYE_TREATMENTS, dentalPath, eyePath } from '../lib/treatments';
import Reveal from './Reveal';

/** @param {'dental'|'eye'} variant */
export default function Treatments({ variant = 'dental' }) {
  const { t } = useLang();
  const p = `${variant}.treat`;
  const items = variant === 'dental' ? DENTAL_TREATMENTS : EYE_TREATMENTS;
  const hrefFor = variant === 'dental' ? dentalPath : eyePath;

  return (
    <section className="section section--paper" id="treatments">
      <div className="container">
        <Reveal className="section-head center">
          <p className="kicker">{t(`${p}.kicker`)}</p>
          <h2 className="section-title">{t(`${p}.title`)}</h2>
          <p className="section-lead">{t(`${p}.lead`)}</p>
        </Reveal>

        <div className="treat-grid">
          {items.map((item, i) => {
            const titleKey = `${p}.t${item.id}`;
            const descKey = `${p}.t${item.id}.d`;
            const desc = t(descKey);
            const hasDesc = desc && desc !== descKey;
            return (
              <Reveal key={item.slug} delay={(i % 3) + 1} className="treat-card treat-card--link">
                <Link to={hrefFor(item.slug)} className="treat-card__link">
                  {item.image ? (
                    <span className="treat-card__thumb">
                      <img src={item.image} alt="" loading="lazy" />
                    </span>
                  ) : (
                    <span className="treat-card__mark" aria-hidden="true" />
                  )}
                  <h3>{t(titleKey)}</h3>
                  {hasDesc ? <p className="treat-card__desc">{desc}</p> : null}
                  <span className="treat-card__more">{t('treat.read')} →</span>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
