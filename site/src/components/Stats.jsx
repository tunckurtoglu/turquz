import React from 'react';
import { useLang } from '../i18n/LangContext';
import Reveal from './Reveal';
import { IconGrid, IconGlobe, IconPin, IconHeadset } from './Icons';

const STATS = [
  [IconGrid, 'stat1n', 'stat1l'],
  [IconGlobe, 'stat2n', 'stat2l'],
  [IconPin, 'stat3n', 'stat3l'],
  [IconHeadset, 'stat4n', 'stat4l'],
];

export default function Stats() {
  const { t } = useLang();
  return (
    <section className="stats-band">
      <div className="container">
        <div className="stats-row">
          {STATS.map(([Icon, n, l], i) => (
            <Reveal key={n} delay={(i % 4) + 1} className="stat">
              <div className="stat__ic"><Icon size={26} /></div>
              <div>
                <div className="stat__n">{t(n)}</div>
                <div className="stat__l">{t(l)}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
