import React, { useEffect } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import Icon from '@/components/Icon';

// Autoplaying, looping preview used in feed/grid contexts — starts muted,
// but (unlike a plain thumbnail) carries its own small mute toggle so sound
// can be turned on right there without opening the post. The card around
// this is itself a Pressable that navigates on tap; nesting this button
// inside it works the same way SwipeToAction's action button does — the
// innermost Pressable claims the touch, so tapping the icon doesn't also
// trigger the card's navigation.
//
// isVisible is driven by the parent screen's own scroll/viewport tracking —
// this component just plays or pauses in response rather than deciding for
// itself, since it has no way to know where it sits on screen. Defaults to
// true for screens that don't track visibility, so it just autoplays as
// before there.
export default function VideoThumb({
  uri, style, isVisible = true,
}: {
  uri: string; style?: StyleProp<ViewStyle>; isVisible?: boolean;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });
  const { muted } = useEvent(player, 'mutedChange', { muted: player.muted });

  useEffect(() => {
    if (isVisible) player.play(); else player.pause();
  }, [isVisible, player]);

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
        <Icon name={muted ? 'volume-off' : 'volume-on'} size={11} color="white" />
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
