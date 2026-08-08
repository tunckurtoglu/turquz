import React, { useEffect, useState } from 'react';
import { useLang } from '../i18n/LangContext';
import Reveal from './Reveal';
import { GALLERY } from '../lib/gallery';
import { IconChevron } from './Icons';

export default function Gallery() {
  const { t, dir } = useLang();
  const [i, setI] = useState(0);
  const n = GALLERY.length;
  const has = n > 0;

  useEffect(() => {
    if (n < 2) return;
    const id = setInterval(() => setI((p) => (p + 1) % n), 5000);
    return () => clearInterval(id);
  }, [n]);

  const move = (d) => setI((p) => (p + d + n) % n);
  const prevStep = dir === 'rtl' ? 1 : -1;

  return (
    <section className="section section--paper" id="gallery">
      <div className="container">
        <Reveal className="section-head center">
          <p className="kicker">{t('gal.kicker')}</p>
          <h2 className="section-title">{t('gal.title')}</h2>
          <p className="section-lead">{t('gal.lead')}</p>
        </Reveal>

        <Reveal>
          <div className="slides">
            {has ? GALLERY.map((g, idx) => (
              <div className={`slide${idx === i ? ' active' : ''}`} key={g.src} aria-hidden={idx !== i}>
                <img src={g.src} alt={g.caption || `Turquz ${idx + 1}`} loading={idx === 0 ? 'eager' : 'lazy'} />
                {g.caption && <div className="slide__cap">{g.caption}</div>}
              </div>
            )) : (
              <div className="slides__empty"><p>{t('gal.empty')}</p></div>
            )}
            {n > 1 && (
              <>
                <button className="slide-nav prev" onClick={() => move(prevStep)} aria-label="prev" style={{ transform: 'translateY(-50%) rotate(90deg)' }}><IconChevron size={22} /></button>
                <button className="slide-nav next" onClick={() => move(-prevStep)} aria-label="next" style={{ transform: 'translateY(-50%) rotate(-90deg)' }}><IconChevron size={22} /></button>
              </>
            )}
          </div>
          {n > 1 && (
            <div className="slide-dots">
              {GALLERY.map((g, idx) => (
                <button key={g.src} className={idx === i ? 'active' : ''} onClick={() => setI(idx)} aria-label={`slide ${idx + 1}`} />
              ))}
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}
