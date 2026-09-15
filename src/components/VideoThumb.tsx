import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

// Autoplaying, muted, looping preview — used in feed/grid contexts where the
// video itself is the thumbnail (tapping the card navigates to the full
// post, so this never shows its own controls).
export default function VideoThumb({ uri, style }: { uri: string; style?: StyleProp<ViewStyle> }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={[StyleSheet.absoluteFill, style]}
      contentFit="cover"
      nativeControls={false}
      pointerEvents="none"
    />
  );
}
