import React from 'react';
import { useLang } from '../i18n/LangContext';
import { SITE } from '../lib/config';
import Reveal from './Reveal';
import { IconArrow, IconBed, IconBuilding, IconSync } from './Icons';

function PortalCard({
  variant, Icon, title, desc, cta, href, soon, soonLabel,
}) {
  const live = Boolean(href) && !soon;
  const body = (
    <>
      <div className="portal-card__top">
        <span className="portal-card__badge" aria-hidden="true">
          <Icon size={26} />
        </span>
        {soon ? <span className="portal-card__soon">{soonLabel}</span> : null}
      </div>
      <h3>{title}</h3>
      <p>{desc}</p>
      <span className="portal-card__cta">
        {cta}
        {live ? <IconArrow size={16} /> : null}
      </span>
    </>
  );

  if (live) {
    return (
      <a
        className={`portal-card portal-card--${variant}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {body}
      </a>
    );
  }

  return (
    <div className={`portal-card portal-card--${variant} portal-card--soon`} aria-disabled="true">
      {body}
    </div>
  );
}

export default function Partners() {
  const { t } = useLang();

  return (
    <section className="section section--paper partners" id="partners">
      <div className="container">
        <Reveal className="section-head center">
          <p className="kicker">{t('partners.kicker')}</p>
          <h2 className="section-title">{t('partners.title')}</h2>
          <p className="section-lead">{t('partners.lead')}</p>
        </Reveal>

        <div className="portal-grid">
          <Reveal delay={1}>
            <PortalCard
              variant="agency"
              Icon={IconBuilding}
              title={t('partners.agency.title')}
              desc={t('partners.agency.desc')}
              cta={t('partners.agency.cta')}
              href={SITE.agencyPanelUrl}
            />
          </Reveal>
          <Reveal delay={2}>
            <PortalCard
              variant="hotel"
              Icon={IconBed}
              title={t('partners.hotel.title')}
              desc={t('partners.hotel.desc')}
              cta={SITE.hotelPanelUrl ? t('partners.hotel.cta') : t('partners.hotel.ctaSoon')}
              href={SITE.hotelPanelUrl}
              soon={!SITE.hotelPanelUrl}
              soonLabel={t('app.soon')}
            />
          </Reveal>
        </div>

        <Reveal delay={3} className="partners__sync">
          <span className="partners__sync-ic" aria-hidden="true"><IconSync size={20} /></span>
          <p>{t('partners.sync')}</p>
        </Reveal>
      </div>
    </section>
  );
}
