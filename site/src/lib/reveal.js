import { useEffect, useRef, useState } from 'react';

// Scroll ile görünür olunca .in sınıfı ekleyen hafif IntersectionObserver hook'u.
// Kullanım: const { ref, shown } = useReveal();  <div ref={ref} className={`reveal ${shown ? 'in' : ''}`}>
export function useReveal(options = {}) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Hareketi azalt tercihi varsa anında göster.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px', ...options }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, shown };
}
