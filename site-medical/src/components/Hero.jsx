import React, { useEffect, useRef } from 'react';
import { useLang } from '../i18n/LangContext';
import { HERO_IMAGE, HERO_VIDEO } from '../lib/hero';
import { IconArrow } from './Icons';
import ConsultLink from './ConsultLink';

const POSTER = '/hero/poster.jpg';

/**
 * @param {'home'|'dental'|'eye'} variant
 * @param {string} [cta2Href]
 */
export default function Hero({ variant = 'home', cta2Href = '#journey', showImage = true }) {
  const { t } = useLang();
  const sectionRef = useRef(null);
  const p = variant === 'home' ? 'hero' : `${variant}.hero`;
  const go = (href) => document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });

  const useVideo = (variant === 'home' || variant === 'dental') && !!HERO_VIDEO;
  const useImg = !useVideo && showImage && variant !== 'eye' && HERO_IMAGE;

  const posterUrl = useVideo ? POSTER : HERO_IMAGE;
  const bgStyle = (useVideo || useImg) && posterUrl
    ? {
        backgroundImage: [
          'linear-gradient(180deg, rgba(15,22,32,0.58) 0%, rgba(15,22,32,0.82) 100%)',
          `url(${posterUrl})`,
        ].join(', '),
        backgroundSize: 'cover',
        backgroundPosition: 'center 30%',
      }
    : undefined;

  useEffect(() => {
    const v = document.getElementById('tq-hero-vid');
    const section = sectionRef.current;

    if (!useVideo) {
      document.body.classList.remove('tq-hero-video-on', 'tq-hero-playing');
      if (v) {
        try { v.pause(); } catch { /* ignore */ }
      }
      return undefined;
    }

    if (!v) return undefined;

    document.body.classList.add('tq-hero-video-on');
    v.defaultMuted = true;
    v.muted = true;
    v.volume = 0;
    v.controls = false;
    v.removeAttribute('controls');

    const markPlaying = () => document.body.classList.add('tq-hero-playing');
    const markStopped = () => document.body.classList.remove('tq-hero-playing');

    const play = () => {
      v.muted = true;
      v.volume = 0;
      const req = v.play();
      if (req && typeof req.then === 'function') {
        req.then(markPlaying).catch(markStopped);
      }
    };

    v.addEventListener('playing', markPlaying);
    v.addEventListener('pause', markStopped);
    // Sayfa geçişinde (ana ↔ diş) yeniden başlat
    try { v.currentTime = 0; } catch { /* ignore */ }
    play();
    // Bir frame sonra tekrar dene (unmount pause yarışı)
    const t1 = window.setTimeout(play, 50);
    const t2 = window.setTimeout(play, 300);

    const io = section
      ? new IntersectionObserver(
        ([entry]) => {
          const on = entry.isIntersecting && entry.intersectionRatio > 0.05;
          document.body.classList.toggle('tq-hero-video-on', on);
          if (on) play();
          else {
            try { v.pause(); } catch { /* ignore */ }
            markStopped();
          }
        },
        { threshold: [0, 0.05, 0.2] },
      )
      : null;
    if (io && section) io.observe(section);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      if (io) io.disconnect();
      v.removeEventListener('playing', markPlaying);
      v.removeEventListener('pause', markStopped);
      // pause etme — diğer video sayfasına geçerken play’i bozmasın
      document.body.classList.remove('tq-hero-playing');
    };
  }, [useVideo, variant]);

  return (
    <section
      ref={sectionRef}
      className={`hero${useVideo ? ' hero--video' : ''}${useImg || useVideo ? ' hero--img' : ''}`}
      id="hero"
      style={bgStyle}
    >
      {useVideo && <div className="hero__veil" aria-hidden="true" />}
      {!useVideo && !useImg && <div className="hero__glow" />}
      <div className="container hero__inner">
        <h1>{t(`${p}.title`)} <span className="accent">{t(`${p}.accent`)}</span></h1>
        <p className="hero__lead">{t(`${p}.sub`)}</p>
        <div className="hero__cta">
          <ConsultLink className="btn btn--gold btn--lg">
            {t(`${p}.cta1`)} <IconArrow size={18} />
          </ConsultLink>
          <button type="button" className="btn btn--ghost-light btn--lg" onClick={() => go(cta2Href)}>
            {t(`${p}.cta2`)}
          </button>
        </div>
      </div>
      <div className="hero__scroll"><span className="line" /></div>
    </section>
  );
}
