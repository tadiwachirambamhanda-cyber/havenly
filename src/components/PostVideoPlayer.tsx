import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import Icon from '@/components/Icon';

export interface PostVideoPlayerHandle {
  toggleMute: () => void;
}

// The full player used on Post Detail — branded controls instead of the
// OS's own, since a viewer here has deliberately opened the post (not just
// scrolling past it): tap to play/pause, a slim progress bar, seamless
// looping. Starts muted regardless, matching the feed preview and avoiding
// an unexpected burst of audio — the mute toggle itself lives in the
// caller's action rail (passed a ref here) rather than floating on the
// video, so it sits in the same reachable spot as like/comment/share.
const PostVideoPlayer = forwardRef<PostVideoPlayerHandle, {
  uri: string; onDoubleTap?: () => void; onMutedChange?: (muted: boolean) => void;
}>(function PostVideoPlayer({ uri, onDoubleTap, onMutedChange }, ref) {
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

  useEffect(() => { onMutedChange?.(muted); }, [muted, onMutedChange]);

  useImperativeHandle(ref, () => ({ toggleMute: () => { player.muted = !player.muted; } }), [player]);

  // Every tap toggles play/pause immediately (no delay, so the primary
  // action stays responsive) — a tap that turns out to be the second half
  // of a double-tap just toggles it back a moment later, a harmless flicker
  // in exchange for not slowing down normal single taps.
  const handlePress = () => {
    if (isPlaying) player.pause();
    else player.play();
    const now = Date.now();
    if (onDoubleTap && now - lastTapRef.current < 300) onDoubleTap();
    lastTapRef.current = now;
  };

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={handlePress}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      {!isPlaying && (
        <View style={[StyleSheet.absoluteFill, styles.playOverlay]} pointerEvents="none">
          <View style={styles.playCircle}><Icon name="play" size={24} color="white" /></View>
        </View>
      )}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
    </Pressable>
  );
});

export default PostVideoPlayer;

const styles = StyleSheet.create({
  playOverlay: { alignItems: 'center', justifyContent: 'center' },
  playCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  progressTrack: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  progressFill: { height: '100%', backgroundColor: '#FF5A3C' },
});
