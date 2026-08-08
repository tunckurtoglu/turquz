import React from 'react';
import Hero from '../components/Hero';
import Treatments from '../components/Treatments';
import ClinicExperience from '../components/ClinicExperience';
import Journey from '../components/Journey';
import Why from '../components/Why';
import Gallery from '../components/Gallery';
import Faq from '../components/Faq';
import Cta from '../components/Cta';

export default function DentalPage() {
  return (
    <>
      <Hero key="dental" variant="dental" cta2Href="#treatments" showImage />
      <Treatments variant="dental" />
      <ClinicExperience />
      <Journey variant="dental" />
      <Why />
      <Gallery />
      <Faq />
      <Cta />
    </>
  );
}
