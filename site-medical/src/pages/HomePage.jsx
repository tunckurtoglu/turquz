import React from 'react';
import Hero from '../components/Hero';
import Intro from '../components/Intro';
import Paths from '../components/Paths';
import Journey from '../components/Journey';
import Why from '../components/Why';
import Faq from '../components/Faq';
import Cta from '../components/Cta';

export default function HomePage() {
  return (
    <>
      <Hero key="home" variant="home" cta2Href="#services" showImage />
      <Paths />
      <Intro variant="home" />
      <Journey variant="home" />
      <Why />
      <Faq />
      <Cta />
    </>
  );
}
