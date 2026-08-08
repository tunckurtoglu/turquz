import React from 'react';
import { useLang } from '../i18n/LangContext';
import Reveal from './Reveal';
import { IconArrow } from './Icons';
import ConsultLink from './ConsultLink';

export default function Cta() {
  const { t } = useLang();
  return (
    <section className="section section--ink" id="consult">
      <div className="container">
        <Reveal className="appcta">
          <div className="appcta__inner">
            <p className="kicker" style={{ color: 'var(--gold-light)' }}>{t('cta.kicker')}</p>
            <h2>{t('cta.title')}</h2>
            <ConsultLink className="btn btn--gold btn--lg">
              {t('cta.btn')} <IconArrow size={18} />
            </ConsultLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
