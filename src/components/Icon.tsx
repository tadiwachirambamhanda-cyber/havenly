import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { ICONS } from './phosphorIcons';

export type IconName = keyof typeof ICONS;
export type IconWeight = 'regular' | 'bold' | 'fill' | 'duotone';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  // Defaults by size: small icons (most of the app) use Phosphor's bold
  // stroke so they read at 12–18px; larger ones use regular. Pass 'fill'
  // for active and selected states (current tab, liked, saved).
  weight?: IconWeight;
  style?: StyleProp<ViewStyle>;
}

export default function Icon({ name, size = 18, color, weight, style }: Props) {
  const Component = ICONS[name];
  // Types make an unknown name impossible, but a stale bundle mid-reload can
  // still hand one over; render nothing rather than crash the whole screen.
  if (!Component) return null;
  return <Component size={size} color={color} weight={weight ?? (size <= 20 ? 'bold' : 'regular')} style={style} />;
}
