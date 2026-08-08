import React from 'react';
import { useLang } from '../i18n/LangContext';
import Reveal from './Reveal';

const CARDS = [
  { title: 'clinic.b1.t', desc: 'clinic.b1.d', img: '/clinic/amenity-1.webp' },
  { title: 'clinic.b2.t', desc: 'clinic.b2.d', img: '/clinic/amenity-2.webp' },
  { title: 'clinic.b3.t', desc: 'clinic.b3.d', img: '/clinic/amenity-3.webp' },
  { title: 'clinic.b4.t', desc: 'clinic.b4.d', img: '/clinic/amenity-4.webp' },
];

/** Diş sayfası — anlaşmalı klinik ortamı / olanaklar (marka adı yok). */
export default function ClinicExperience() {
  const { t } = useLang();

  return (
    <section className="section section--paper" id="clinic">
      <div className="container">
        <Reveal className="section-head center">
          <p className="kicker">{t('clinic.kicker')}</p>
          <h2 className="section-title">{t('clinic.title')}</h2>
          <p className="section-lead">{t('clinic.lead')}</p>
        </Reveal>

        <div className="clinic-grid">
          {CARDS.map((c, i) => (
            <Reveal key={c.title} delay={(i % 4) + 1} className="clinic-card">
              <div className="clinic-card__media">
                <img src={c.img} alt="" loading="lazy" />
              </div>
              <div className="clinic-card__body">
                <h3>{t(c.title)}</h3>
                <p>{t(c.desc)}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="clinic-mosaic" delay={2}>
          <div className="clinic-mosaic__item"><img src="/clinic/ambience-1.jpg" alt="" loading="lazy" /></div>
          <div className="clinic-mosaic__item"><img src="/clinic/ambience-2.jpg" alt="" loading="lazy" /></div>
          <div className="clinic-mosaic__item"><img src="/clinic/ambience-3.jpg" alt="" loading="lazy" /></div>
        </Reveal>
      </div>
    </section>
  );
}
