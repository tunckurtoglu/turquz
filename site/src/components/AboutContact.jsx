import React, { useState } from 'react';
import { useLang } from '../i18n/LangContext';
import { contactEmail } from '../lib/config';
import { submitContact } from '../lib/supabase';
import Reveal from './Reveal';
import { IconArrow, IconCheck } from './Icons';

const COUNTRIES = [
  'Türkiye', 'Kazakhstan', 'Kyrgyzstan', 'Uzbekistan', 'Turkmenistan',
  'Azerbaijan', 'Russia', 'Germany', 'Thailand', 'Iran', 'Other',
];
const SUBJECTS = ['subj.careers', 'subj.medical', 'subj.software', 'subj.academy', 'subj.tour', 'subj.trade', 'subj.other'];

export default function AboutContact() {
  const { t, lang } = useLang();
  const go = (href) => document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
  const [form, setForm] = useState({ name: '', email: '', country: '', subject: '', message: '' });
  const [status, setStatus] = useState('idle');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const mailtoFallback = () => {
    const subject = encodeURIComponent(`[Turquz] ${form.subject || 'Talep'} — ${form.name}`);
    const body = encodeURIComponent(`${form.name}\n${form.email}\n${form.country}\n\n${form.message}`);
    window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await submitContact({
        name: form.name,
        org: form.country,       // ülke -> org kolonu
        email: form.email,
        kind: form.subject,      // konu -> kind kolonu
        message: form.message,
        lang,
      });
      if (res.ok) { setStatus('ok'); return; }
      mailtoFallback();
      setStatus('ok');
    } catch {
      setStatus('error');
    }
  };

  return (
    <section className="section section--paper about-section" id="about">
      <div className="container about-grid">
        {/* Sol: Hakkımızda */}
        <Reveal className="about-col">
          <p className="kicker">{t('about.kicker')}</p>
          <h2 className="about-title">{t('about.title')}</h2>
          <p className="about-text">{t('about.text')}</p>
          <button className="btn btn--gold" onClick={() => go('#services')}>
            {t('about.more')} <IconArrow size={17} />
          </button>
        </Reveal>

        {/* Sağ: Talep formu */}
        <Reveal delay={1} id="contact">
          <form className="form" onSubmit={onSubmit}>
            {status === 'ok' ? (
              <div className="form__ok">
                <div className="ic"><IconCheck size={64} /></div>
                <h3>{t('form.ok.title')}</h3>
                <p>{t('form.ok.text')}</p>
              </div>
            ) : (
              <>
                <h3 className="form__title">{t('form.title')}</h3>
                <p className="form__lead">{t('form.lead')}</p>

                <div className="field-row">
                  <div className="field">
                    <label>{t('form.name')}</label>
                    <input value={form.name} onChange={set('name')} required autoComplete="name" />
                  </div>
                  <div className="field">
                    <label>{t('form.email')}</label>
                    <input type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>{t('form.country')}</label>
                    <select value={form.country} onChange={set('country')}>
                      <option value="">—</option>
                      {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>{t('form.subject')}</label>
                    <select value={form.subject} onChange={set('subject')}>
                      <option value="">—</option>
                      {SUBJECTS.map((s) => <option key={s} value={t(s)}>{t(s)}</option>)}
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label>{t('form.msg')}</label>
                  <textarea value={form.message} onChange={set('message')} required />
                </div>
                <button className="btn btn--gold" type="submit" disabled={status === 'sending'}>
                  {status === 'sending' ? t('form.sending') : t('form.submit')} <IconArrow size={17} />
                </button>
                {status === 'error' && <p className="form__note" style={{ color: 'var(--danger)' }}>{t('form.err')}</p>}
                <p className="form__note">{t('form.note')}</p>
              </>
            )}
          </form>
        </Reveal>
      </div>
    </section>
  );
}
