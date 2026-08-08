import React from 'react';
import { LangProvider } from './i18n/LangContext';
import { Router, useRouter } from './lib/router';
import { parseTreatmentPath } from './lib/treatments';
import Header from './components/Header';
import Footer from './components/Footer';
import WhatsAppFloat from './components/WhatsAppFloat';
import HomePage from './pages/HomePage';
import DentalPage from './pages/DentalPage';
import EyePage from './pages/EyePage';
import TreatmentPage from './pages/TreatmentPage';

function Routes() {
  const { path } = useRouter();
  const treat = parseTreatmentPath(path);
  if (treat) return <TreatmentPage variant={treat.variant} item={treat.item} />;
  if (path === '/dis' || path === '/dental') return <DentalPage />;
  if (path === '/goz' || path === '/eye') return <EyePage />;
  return <HomePage />;
}

export default function App() {
  return (
    <LangProvider>
      <Router>
        <Header />
        <main>
          <Routes />
        </main>
        <Footer />
        <WhatsAppFloat />
      </Router>
    </LangProvider>
  );
}
