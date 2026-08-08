import React from 'react';
import Hero from '../components/Hero';
import Intro from '../components/Intro';
import Journey from '../components/Journey';
import Treatments from '../components/Treatments';
import Why from '../components/Why';
import Faq from '../components/Faq';
import Cta from '../components/Cta';

export default function EyePage() {
  return (
    <>
      <Hero variant="eye" cta2Href="#treatments" showImage={false} />
      <Intro variant="eye" />
      <Treatments variant="eye" />
      <Journey variant="eye" />
      <Why />
      <Faq />
      <Cta />
    </>
  );
}
