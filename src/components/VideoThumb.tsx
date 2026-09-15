import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { Feather } from '@expo/vector-icons';

// Autoplaying, looping preview used in feed/grid contexts — starts muted,
// but (unlike a plain thumbnail) carries its own small mute toggle so sound
// can be turned on right there without opening the post. The card around
// this is itself a Pressable that navigates on tap; nesting this button
// inside it works the same way SwipeToAction's action button does — the
// innermost Pressable claims the touch, so tapping the icon doesn't also
// trigger the card's navigation.
export default function VideoThumb({ uri, style }: { uri: string; style?: StyleProp<ViewStyle> }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  const { muted } = useEvent(player, 'mutedChange', { muted: player.muted });

  return (
    <>
      <VideoView
        player={player}
        style={[StyleSheet.absoluteFill, style]}
        contentFit="cover"
        nativeControls={false}
        pointerEvents="none"
      />
      <Pressable
        style={styles.muteBtn}
        onPress={() => { player.muted = !player.muted; }}
        hitSlop={10}
        accessibilityLabel={muted ? 'Unmute' : 'Mute'}
      >
        <Feather name={muted ? 'volume-x' : 'volume-2'} size={11} color="white" />
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  muteBtn: {
    position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
});
