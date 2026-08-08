import React, { useEffect, useState } from 'react';
import { useLang } from '../i18n/LangContext';
import { loadGallery } from '../lib/gallery';
import Reveal from './Reveal';
import { IconArrow } from './Icons';

export default function Gallery() {
  const { t } = useLang();
  const slides = loadGallery();
  const [i, setI] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const id = setInterval(() => setI((n) => (n + 1) % slides.length), 4500);
    return () => clearInterval(id);
  }, [slides.length]);

  const prev = () => setI((n) => (n - 1 + slides.length) % slides.length);
  const next = () => setI((n) => (n + 1) % slides.length);

  return (
    <section className="section section--paper" id="gallery">
      <div className="container">
        <Reveal className="section-head center">
          <p className="kicker">{t('gal.kicker')}</p>
          <h2 className="section-title">{t('gal.title')}</h2>
          <p className="section-lead">{t('gal.lead')}</p>
        </Reveal>

        <Reveal className="slides">
          {slides.length === 0 ? (
            <div className="slides__empty"><p>{t('gal.empty')}</p></div>
          ) : (
            <>
              {slides.map((s, idx) => (
                <div key={s.src} className={`slide${idx === i ? ' active' : ''}`}>
                  <img src={s.src} alt={s.caption || ''} loading={idx === 0 ? 'eager' : 'lazy'} />
                  {s.caption ? <div className="slide__cap">{s.caption}</div> : null}
                </div>
              ))}
              {slides.length > 1 && (
                <>
                  <button type="button" className="slide-nav prev" onClick={prev} aria-label="Prev"><IconArrow size={18} style={{ transform: 'rotate(180deg)' }} /></button>
                  <button type="button" className="slide-nav next" onClick={next} aria-label="Next"><IconArrow size={18} /></button>
                </>
              )}
            </>
          )}
        </Reveal>
        {slides.length > 1 && (
          <div className="slide-dots">
            {slides.map((_, idx) => (
              <button key={idx} type="button" className={idx === i ? 'active' : ''} onClick={() => setI(idx)} aria-label={`Slide ${idx + 1}`} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
