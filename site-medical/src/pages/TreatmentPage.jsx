import React from 'react';
import { useLang } from '../i18n/LangContext';
import { Link } from '../lib/router';
import { DENTAL_TREATMENTS, EYE_TREATMENTS, dentalPath, eyePath } from '../lib/treatments';
import Reveal from '../components/Reveal';
import Cta from '../components/Cta';
import ConsultLink from '../components/ConsultLink';
import { IconArrow } from '../components/Icons';

/**
 * @param {{ variant: 'dental'|'eye', item: { id: number, slug: string, image?: string } }} props
 */
export default function TreatmentPage({ variant, item }) {
  const { t } = useLang();
  const p = `${variant}.treat`;
  const parent = variant === 'dental' ? '/dis' : '/goz';
  const title = t(`${p}.t${item.id}`);
  const body = t(`${p}.t${item.id}.body`);
  const hasBody = body && body !== `${p}.t${item.id}.body`;
  const teaser = t(`${p}.t${item.id}.d`);
  const hasTeaser = teaser && teaser !== `${p}.t${item.id}.d`;

  const siblings = (variant === 'dental' ? DENTAL_TREATMENTS : EYE_TREATMENTS)
    .filter((x) => x.id !== item.id)
    .slice(0, 6);
  const hrefFor = variant === 'dental' ? dentalPath : eyePath;

  return (
    <>
      <section className="treat-detail">
        <div className="container">
          <Reveal className="treat-detail__top">
            <Link className="treat-detail__back" to={parent}>
              ← {t(variant === 'dental' ? 'treat.back' : 'treat.back.eye')}
            </Link>
            <p className="kicker">{t(`${p}.kicker`)}</p>
            <h1 className="treat-detail__title">{title}</h1>
            {hasTeaser ? <p className="treat-detail__lead">{teaser}</p> : null}
          </Reveal>

          <div className="treat-detail__layout">
            {item.image ? (
              <Reveal delay={1} className="treat-detail__visual">
                <img src={item.image} alt={title} loading="eager" />
              </Reveal>
            ) : null}

            <Reveal delay={2} className="treat-detail__body">
              {hasBody
                ? body.split(/\n\n+/).map((para, i) => <p key={i}>{para}</p>)
                : hasTeaser
                  ? <p>{teaser}</p>
                  : <p>{t('treat.fallback')}</p>}
              <p>{t('treat.how')}</p>

              <div className="treat-detail__actions">
                <ConsultLink className="btn btn--gold btn--lg">
                  {t('cta.btn')} <IconArrow size={18} />
                </ConsultLink>
                <Link className="btn btn--ghost" to={parent}>
                  {t('treat.all')}
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {siblings.length > 0 && (
        <section className="section section--paper">
          <div className="container">
            <Reveal className="section-head">
              <p className="kicker">{t('treat.more.kicker')}</p>
              <h2 className="section-title">{t('treat.more.title')}</h2>
            </Reveal>
            <div className="treat-grid treat-grid--compact">
              {siblings.map((s, i) => (
                <Reveal key={s.slug} delay={(i % 3) + 1} className="treat-card treat-card--link">
                  <Link to={hrefFor(s.slug)} className="treat-card__link">
                    {s.image ? (
                      <span className="treat-card__thumb">
                        <img src={s.image} alt="" loading="lazy" />
                      </span>
                    ) : (
                      <span className="treat-card__mark" aria-hidden="true" />
                    )}
                    <h3>{t(`${p}.t${s.id}`)}</h3>
                    <span className="treat-card__more">{t('treat.read')} →</span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <Cta />
    </>
  );
}
