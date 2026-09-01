// Acente profil fotoğrafı yokken — nötr adam silueti (eski logo sembolü yerine).
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export default function AgencyProfilePlaceholder({ size = 56, color = '#C2A25A' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56" fill="none" accessibilityLabel="Profil">
      <Circle cx="28" cy="20" r="9.5" fill={color} fillOpacity={0.92} />
      <Path
        d="M11 49c0-9.8 7.6-16 17-16s17 6.2 17 16"
        fill={color}
        fillOpacity={0.88}
      />
    </Svg>
  );
}
