import React from 'react';
import { useReveal } from '../lib/reveal';

// Scroll-reveal sarmalayıcı. delay: 0..4 -> .d1..d4 gecikme sınıfı.
export default function Reveal({ children, delay = 0, as: Tag = 'div', className = '', ...rest }) {
  const { ref, shown } = useReveal();
  const d = delay ? ` d${delay}` : '';
  return (
    <Tag ref={ref} className={`reveal${d} ${shown ? 'in' : ''} ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}
