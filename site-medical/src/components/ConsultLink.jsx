import React from 'react';
import { useLang } from '../i18n/LangContext';
import { whatsappHref } from '../lib/config';

/**
 * Bilgi al / Bilgi talebi CTA — WhatsApp sohbetine açar.
 * Ön mesaj seçili dile göre gelir (`wa.message`).
 */
export default function ConsultLink({ className, children, onClick, ...rest }) {
  const { t } = useLang();
  const href = whatsappHref(t('wa.message'));

  if (href) {
    return (
      <a
        className={className}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        {...rest}
      >
        {children}
      </a>
    );
  }

  return (
    <a
      className={className}
      href="#"
      role="link"
      aria-disabled="true"
      onClick={(e) => {
        e.preventDefault();
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
