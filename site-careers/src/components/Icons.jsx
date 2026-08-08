// Hafif, çizgisel (stroke) SVG ikon seti — currentColor ile renklenir.
import React from 'react';

const S = ({ children, size = 24, ...p }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    {children}
  </svg>
);

export const IconBridge = (p) => (<S {...p}><path d="M3 9c3 0 4-2 4-2s1 2 4 2 4-2 4-2 1 2 4 2"/><path d="M3 9v8M21 9v8M8 9v6M16 9v6M12 11v6"/><path d="M2 17h20"/></S>);
export const IconGlobe = (p) => (<S {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"/></S>);
export const IconShield = (p) => (<S {...p}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9.5 12l1.8 1.8 3.2-3.6"/></S>);
export const IconBed = (p) => (<S {...p}><path d="M3 7v11M3 12h18v6M21 12v-1a3 3 0 0 0-3-3h-7v4"/><circle cx="7" cy="11" r="1.4"/></S>);
export const IconSpark = (p) => (<S {...p}><path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15l-1.8-4.2L5.5 9l4.7-1.3z"/><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></S>);
export const IconHealth = (p) => (<S {...p}><path d="M3 12h3l2-5 3 10 2.5-7 1.5 2h6"/></S>);
export const IconTrade = (p) => (<S {...p}><path d="M4 8h13l-3-3M20 16H7l3 3"/></S>);
export const IconCheck = (p) => (<S {...p}><path d="M20 6L9 17l-5-5"/></S>);
export const IconArrow = (p) => (<S {...p}><path d="M5 12h14M13 6l6 6-6 6"/></S>);
export const IconMail = (p) => (<S {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M4 7l8 6 8-6"/></S>);
export const IconPhone = (p) => (<S {...p}><path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v3a2 2 0 0 1-2 2 16 16 0 0 1-14-14 2 2 0 0 1 1-2z"/></S>);
export const IconPin = (p) => (<S {...p}><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></S>);
export const IconCaptions = (p) => (<S {...p}><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 11h3M7 14h5M14 11h3M14 14h3"/></S>);
export const IconScan = (p) => (<S {...p}><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></S>);
export const IconMobile = (p) => (<S {...p}><rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/></S>);
export const IconMask = (p) => (<S {...p}><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.5"/></S>);
export const IconDoc = (p) => (<S {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 16h6"/></S>);
export const IconBell = (p) => (<S {...p}><path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6"/><path d="M10 20a2 2 0 0 0 4 0"/></S>);
export const IconChevron = (p) => (<S {...p}><path d="M6 9l6 6 6-6"/></S>);
export const IconApple = (p) => (<S {...p}><path d="M16 13c0-3 2.5-3.5 2.5-3.5C17.5 7 15.5 7 15 7c-1.5 0-2.5 1-3 1s-1.5-1-3-1c-2 0-4 1.5-4 5 0 4 3 7 4 7 .8 0 1.3-.7 2.5-.7s1.7.7 2.5.7c1 0 2-1.5 2.5-2.5"/><path d="M13 4c.5-1 .3-2 .3-2s-1.3.2-2 1c-.6.8-.5 2-.5 2s1.5-.2 2.2-1z"/></S>);
export const IconPlay = (p) => (<S {...p}><path d="M5 3l14 9-14 9z"/></S>);
export const IconUsers = (p) => (<S {...p}><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.5a3 3 0 0 1 0 5.6M17 13.5a5.5 5.5 0 0 1 3.5 5.1"/></S>);
export const IconCap = (p) => (<S {...p}><path d="M12 4L2 9l10 5 10-5z"/><path d="M6 11v5c0 1.2 2.7 2.5 6 2.5s6-1.3 6-2.5v-5M22 9v5"/></S>);
export const IconPlane = (p) => (<S {...p}><path d="M10.5 13.5L3 12l1-2 7 1 4.5-5a2 2 0 0 1 3 3l-5 4.5 1 7-2 1-1.5-7.5-3 3 .2 3-1.5.5-1.2-2.8L4 17l.5-1.5 3 .2z"/></S>);
export const IconGrid = (p) => (<S {...p}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></S>);
export const IconHeadset = (p) => (<S {...p}><path d="M4 13v-1a8 8 0 0 1 16 0v1"/><rect x="2.5" y="13" width="4" height="6" rx="1.5"/><rect x="17.5" y="13" width="4" height="6" rx="1.5"/><path d="M20 19a4 4 0 0 1-4 3h-2"/></S>);
export const IconBuilding = (p) => (
  <S {...p}>
    <rect x="4" y="3" width="16" height="18" rx="1.5" />
    <path d="M8 7v.5M12 7v.5M16 7v.5M8 11v.5M12 11v.5M16 11v.5M8 15v.5M12 15v.5M16 15v.5" />
    <path d="M10 21v-4h4v4" />
  </S>
);
export const IconSync = (p) => (
  <S {...p}>
    <path d="M21 12a9 9 0 0 0-15.5-6.3" />
    <path d="M3 4v5h5" />
    <path d="M3 12a9 9 0 0 0 15.5 6.3" />
    <path d="M21 20v-5h-5" />
  </S>
);
