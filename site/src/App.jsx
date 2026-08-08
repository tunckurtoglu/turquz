import React from 'react';
import { LangProvider } from './i18n/LangContext';
import Header from './components/Header';
import Hero from './components/Hero';
import Services from './components/Services';
import Stats from './components/Stats';
import AboutContact from './components/AboutContact';
import Gallery from './components/Gallery';
import Partners from './components/Partners';
import Footer from './components/Footer';
import WhatsAppFloat from './components/WhatsAppFloat';

export default function App() {
  return (
    <LangProvider>
      <Header />
      <main>
        <Hero />
        <Services />
        <Stats />
        <Gallery />
        <AboutContact />
        <Partners />
      </main>
      <Footer />
      <WhatsAppFloat />
    </LangProvider>
  );
}
