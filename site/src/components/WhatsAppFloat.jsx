import React from 'react';
import { useLang } from '../i18n/LangContext';
import { whatsappHref } from '../lib/config';
import { IconWhatsApp } from './Icons';

/** Ana site WhatsApp float. Ön mesaj seçili dile göre (`wa.message`). */
export default function WhatsAppFloat() {
  const { t } = useLang();
  const href = whatsappHref(t('wa.message'));
  const ready = Boolean(href);
  const label = t('wa.label');

  if (ready) {
    return (
      <a
        className="wa-float"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        title={label}
      >
        <IconWhatsApp size={40} />
      </a>
    );
  }

  return (
    <button
      type="button"
      className="wa-float wa-float--pending"
      aria-label={label}
      title={label}
      onClick={(e) => e.preventDefault()}
    >
      <IconWhatsApp size={40} />
    </button>
  );
}
