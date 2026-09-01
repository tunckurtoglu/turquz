// Destek / iletişim ikonu (mikrofonlu kulaklık) — mesaj balonundan ayrı.
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export default function ContactIcon({ color = '#c2a25a', size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityLabel="İletişim">
      <Path
        d="M5.5 13V11a6.5 6.5 0 0 1 13 0v2"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <Path
        d="M4 13v2.5a2.5 2.5 0 0 0 2.5 2.5H6.5"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M20 13v2.5a2.5 2.5 0 0 1-2.5 2.5H17.5"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7.5 18.2a3.6 3.6 0 0 0-2.9 3.5"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <Path
        d="M4.6 21.7h2.6"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <Circle cx="4.6" cy="21.7" r="1.35" stroke={color} strokeWidth="1.7" />
    </Svg>
  );
}
