// [Layer: LANDING_PAGE/Features/Pages/Home]
// Responsibility: Public emergency overview, duty agency status, hotlines, and quick actions.
// Exposes the master unified LandingPage for ResQTrack.
// DO NOT expose admin management actions on public home screens.

import React from 'react';
import { LandingPage } from '../LandingPage/LandingPage';

export const Home: React.FC = () => {
  return <LandingPage />;
};

export default Home;
