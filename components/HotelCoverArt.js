// components/HotelCoverArt.js
// Otellerim kapak placeholder — mockup’taki resort silüeti (otel + ağaçlar + gökyüzü).
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Defs, LinearGradient, Stop, Rect, Path, Circle, G, Line, Ellipse,
} from 'react-native-svg';

const GOLD = '#A89468';
const GOLD_SOFT = '#C8B88E';
const SKY_TOP = '#1a2844';
const SKY_BOT = '#0c1424';
const SILHOUETTE = '#1e2d48';
const SILHOUETTE_LT = '#2d4468';
const SILHOUETTE_MID = '#243552';

function PalmTree({ x, trunkH = 58, scale = 1, opacity = 0.95 }) {
  const base = 158;
  const top = base - trunkH;
  const cx = x;
  return (
    <G opacity={opacity} transform={`translate(${cx - 50 * scale}, 0) scale(${scale})`}>
      <Path
        d={`M50 ${base} C50 ${base - trunkH * 0.35} 50 ${top + 8} 50 ${top}`}
        stroke={SILHOUETTE_LT}
        strokeWidth="3.2"
        fill="none"
        strokeLinecap="round"
      />
      <Path d="M50 28 L22 52 M50 28 L14 44 M50 28 L26 64 M50 28 L38 70" stroke={SILHOUETTE_LT} strokeWidth="2.4" strokeLinecap="round" />
      <Path d="M50 28 L78 50 M50 28 L86 42 M50 28 L74 62 M50 28 L62 68" stroke={SILHOUETTE_LT} strokeWidth="2.4" strokeLinecap="round" />
      <Path d="M50 28 L50 10 M50 28 L42 14 M50 28 L58 14" stroke={SILHOUETTE_LT} strokeWidth="2" strokeLinecap="round" />
    </G>
  );
}

function PineTree({ x, h = 46, opacity = 0.9 }) {
  const base = 158;
  const top = base - h;
  return (
    <G opacity={opacity}>
      <Line x1={x} y1={base} x2={x} y2={top + 14} stroke={SILHOUETTE_LT} strokeWidth="2.4" strokeLinecap="round" />
      <Path d={`M${x - 14} ${top + 28} L${x} ${top + 8} L${x + 14} ${top + 28} Z`} fill={SILHOUETTE_MID} />
      <Path d={`M${x - 16} ${top + 40} L${x} ${top + 18} L${x + 16} ${top + 40} Z`} fill={SILHOUETTE} />
      <Path d={`M${x - 18} ${top + 52} L${x} ${top + 30} L${x + 18} ${top + 52} Z`} fill={SILHOUETTE_LT} opacity={0.85} />
    </G>
  );
}

export default function HotelCoverArt({ height = 140 }) {
  const [width, setWidth] = useState(360);

  return (
    <View
      style={[styles.wrap, { height }]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - width) > 1) setWidth(w);
      }}
    >
      <Svg width={width} height={height} viewBox="0 0 360 200" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={SKY_TOP} />
            <Stop offset="0.55" stopColor="#121d32" />
            <Stop offset="1" stopColor={SKY_BOT} />
          </LinearGradient>
          <LinearGradient id="horizonGlow" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={GOLD} stopOpacity="0" />
            <Stop offset="1" stopColor={GOLD} stopOpacity="0.22" />
          </LinearGradient>
          <LinearGradient id="bldGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={SILHOUETTE_LT} />
            <Stop offset="1" stopColor={SILHOUETTE} />
          </LinearGradient>
          <LinearGradient id="poolGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1a3050" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#0f1829" stopOpacity="0.9" />
          </LinearGradient>
        </Defs>

        <Rect width="360" height="200" fill="url(#skyGrad)" />

        <G opacity={0.09} stroke={GOLD_SOFT} strokeWidth="0.55">
          {[40, 80, 120, 160, 200, 240, 280, 320].map((x) => (
            <Line key={`v${x}`} x1={x} y1="0" x2={x} y2="132" />
          ))}
          {[18, 42, 66, 90, 114].map((y) => (
            <Line key={`h${y}`} x1="0" y1={y} x2="360" y2={y} />
          ))}
        </G>

        {[
          [24, 18, 1.3], [48, 34, 1], [86, 14, 1.1], [312, 24, 1.2], [336, 44, 0.85],
          [288, 12, 0.75], [142, 28, 0.95], [218, 20, 1.05], [176, 48, 0.65], [252, 38, 0.8],
        ].map(([cx, cy, r], i) => (
          <Circle key={`star-${i}`} cx={cx} cy={cy} r={r} fill={GOLD_SOFT} opacity={0.38 + (i % 3) * 0.1} />
        ))}

        <Ellipse cx="180" cy="166" rx="150" ry="44" fill="url(#horizonGlow)" />

        <Path d="M0 154 Q90 144 180 150 Q270 156 360 148 L360 200 L0 200 Z" fill="#0f1829" />
        <Path d="M0 158 Q120 151 180 154 Q240 157 360 152" stroke={GOLD} strokeWidth="0.9" opacity={0.24} fill="none" />

        <PalmTree x={34} trunkH={62} scale={0.92} />
        <PineTree x={302} h={50} />
        <PineTree x={326} h={42} opacity={0.78} />
        <PineTree x={288} h={36} opacity={0.65} />

        <Rect x="72" y="112" width="26" height="46" rx="1" fill={SILHOUETTE} opacity={0.72} />
        <Path d="M68 112 L85 98 L102 112" fill={SILHOUETTE_MID} opacity={0.7} />
        {[78, 86, 94].map((y) => (
          <Rect key={`lw${y}`} x="77" y={y} width="5" height="6" rx="0.5" fill={GOLD_SOFT} opacity={0.2} />
        ))}

        <G>
          <Rect x="108" y="68" width="144" height="90" rx="2" fill="url(#bldGrad)" />
          <Path d="M100 68 L180 40 L260 68 Z" fill={SILHOUETTE_LT} />
          <Path d="M100 68 L180 40 L260 68" stroke={GOLD} strokeWidth="1" opacity={0.42} fill="none" />
          <Rect x="146" y="114" width="68" height="44" fill="#0a1220" opacity={0.62} />
          <Rect x="153" y="120" width="12" height="38" rx="1" fill={SILHOUETTE_LT} />
          <Rect x="191" y="120" width="12" height="38" rx="1" fill={SILHOUETTE_LT} />
          <Path d="M148 114 L180 96 L212 114" stroke={GOLD} strokeWidth="0.9" opacity={0.45} fill="none" />
          <Line x1="108" y1="94" x2="252" y2="94" stroke={GOLD} strokeWidth="0.55" opacity={0.22} />
          <Line x1="108" y1="114" x2="252" y2="114" stroke={GOLD} strokeWidth="0.55" opacity={0.16} />
          <Line x1="108" y1="134" x2="252" y2="134" stroke={GOLD} strokeWidth="0.55" opacity={0.12} />
          {[
            [120, 76], [138, 76], [156, 76], [174, 76], [192, 76], [210, 76], [228, 76],
            [120, 100], [138, 100], [210, 100], [228, 100],
            [120, 124], [138, 124], [210, 124], [228, 124],
          ].map(([x, y], i) => (
            <Rect
              key={`win-${i}`}
              x={x}
              y={y}
              width="13"
              height="11"
              rx="1"
              fill={GOLD_SOFT}
              opacity={0.26 + (i % 4) * 0.09}
            />
          ))}
          <Rect x="164" y="48" width="32" height="14" rx="2" fill={GOLD} opacity={0.3} />
          <Rect x="170" y="52" width="8" height="6" rx="1" fill={GOLD_SOFT} opacity={0.35} />
          <Rect x="182" y="52" width="8" height="6" rx="1" fill={GOLD_SOFT} opacity={0.35} />
        </G>

        <Rect x="252" y="108" width="30" height="50" rx="1" fill={SILHOUETTE} opacity={0.68} />
        <Path d="M248 108 L267 94 L286 108" fill={SILHOUETTE_MID} opacity={0.62} />
        {[258, 266, 274].map((y) => (
          <Rect key={`rw${y}`} x="257" y={y} width="5" height="6" rx="0.5" fill={GOLD_SOFT} opacity={0.18} />
        ))}

        <Ellipse cx="180" cy="156" rx="72" ry="8" fill="url(#poolGrad)" />
        <Path d="M118 156 Q180 150 242 156" stroke={GOLD_SOFT} strokeWidth="0.7" opacity={0.2} fill="none" />
        <Rect x="124" y="150" width="112" height="5" rx="2.5" fill={GOLD} opacity={0.07} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#0c1424',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(168,148,104,0.22)',
  },
});
