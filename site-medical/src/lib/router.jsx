import React, { createContext, useContext, useEffect, useState } from 'react';

const RouterCtx = createContext({ path: '/', navigate: () => {} });

function normalize(pathname) {
  const p = (pathname || '/').replace(/\/+$/, '') || '/';
  return p;
}

export function Router({ children }) {
  const [path, setPath] = useState(() => normalize(window.location.pathname));

  useEffect(() => {
    const onPop = () => setPath(normalize(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = (to, { replace = false } = {}) => {
    const next = normalize(to);
    if (next === normalize(window.location.pathname)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (replace) window.history.replaceState({}, '', next);
    else window.history.pushState({}, '', next);
    setPath(next);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  return (
    <RouterCtx.Provider value={{ path, navigate }}>
      {children}
    </RouterCtx.Provider>
  );
}

export function useRouter() {
  return useContext(RouterCtx);
}

export function Link({ to, children, className, onClick, ...rest }) {
  const { navigate } = useRouter();
  return (
    <a
      href={to}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onClick?.(e);
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
