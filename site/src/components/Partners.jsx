import React from 'react';
import { useLang } from '../i18n/LangContext';
import Reveal from './Reveal';

// Çözüm ortakları — logo dosyası gelince bu metin çipleri görselle değiştirilebilir.
const PARTNERS = ['TİKA', 'TÜRSAB', 'DEİK', 'MÜSİAD', 'ATO'];

export default function Partners() {
  const { t } = useLang();
  return (
    <section className="section section--card partners">
      <div className="container">
        <Reveal className="section-head center" style={{ marginBottom: 40 }}>
          <p className="kicker">{t('partners.kicker')}</p>
        </Reveal>
        <Reveal className="partners-row">
          {PARTNERS.map((p) => (
            <div className="partner" key={p}>{p}</div>
          ))}
          <div className="partner partner--more">{t('partners.more')}</div>
        </Reveal>
      </div>
    </section>
  );
}
