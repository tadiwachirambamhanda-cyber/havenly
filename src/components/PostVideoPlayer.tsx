import React, { useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/lib/ThemeContext';
import type { ColorTokens } from '@/theme/tokens';

// The full player used on Post Detail — branded controls instead of the
// OS's own, since a viewer here has deliberately opened the post (not just
// scrolling past it): tap to play/pause, tap the corner icon to unmute, a
// slim progress bar, seamless looping. Starts muted regardless, matching
// the feed preview and avoiding an unexpected burst of audio.
export default function PostVideoPlayer({ uri, onDoubleTap }: { uri: string; onDoubleTap?: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const lastTapRef = useRef(0);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.timeUpdateEventInterval = 0.25;
    p.play();
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { muted } = useEvent(player, 'mutedChange', { muted: player.muted });
  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0,
  });
  const duration = player.duration || 0;
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  // Every tap toggles play/pause immediately (no delay, so the primary
  // action stays responsive) — a tap that turns out to be the second half
  // of a double-tap just toggles it back a moment later, a harmless flicker
  // in exchange for not slowing down normal single taps.
  const handlePress = () => {
    isPlaying ? player.pause() : player.play();
    const now = Date.now();
    if (onDoubleTap && now - lastTapRef.current < 300) onDoubleTap();
    lastTapRef.current = now;
  };

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={handlePress}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      {!isPlaying && (
        <View style={[StyleSheet.absoluteFill, styles.playOverlay]} pointerEvents="none">
          <View style={styles.playCircle}><Feather name="play" size={24} color="white" /></View>
        </View>
      )}
      <Pressable style={styles.muteBtn} onPress={() => { player.muted = !player.muted; }} hitSlop={10}>
        <Feather name={muted ? 'volume-x' : 'volume-2'} size={14} color="white" />
      </Pressable>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.coral }]} />
      </View>
    </Pressable>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    playOverlay: { alignItems: 'center', justifyContent: 'center' },
    playCircle: {
      width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center', justifyContent: 'center',
    },
    muteBtn: {
      position: 'absolute', bottom: 14, right: 12, width: 30, height: 30, borderRadius: 15,
      backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
    },
    progressTrack: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
    progressFill: { height: '100%' },
  });
}
