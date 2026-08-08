import React from 'react';
import { LangProvider } from './i18n/LangContext';
import Header from './components/Header';
import Hero from './components/Hero';
import Intro from './components/Intro';
import Offer from './components/Offer';
import Partners from './components/Partners';
import Gallery from './components/Gallery';
import Faq from './components/Faq';
import AppCta from './components/AppCta';
import Footer from './components/Footer';
import ContractPortal from './pages/ContractPortal';

function isContractPath() {
  const p = (typeof window !== 'undefined' ? window.location.pathname : '').replace(/\/+$/, '') || '/';
  return p === '/sozlesme' || p.endsWith('/sozlesme');
}

function CareersLanding() {
  return (
    <LangProvider>
      <Header />
      <main>
        <Hero />
        <Intro />
        <Offer />
        <Partners />
        <Gallery />
        <Faq />
        <AppCta />
      </main>
      <Footer />
    </LangProvider>
  );
}

export default function App() {
  // App’ten gelen gizli path — kariyer menüsünde link yok.
  if (isContractPath()) return <ContractPortal />;
  return <CareersLanding />;
}
