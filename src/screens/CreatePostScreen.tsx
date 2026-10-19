import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, ActivityIndicator, PanResponder } from 'react-native';
import AnimatedPressable from '@/components/AnimatedPressable';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Image } from 'expo-image';
import Icon from '@/components/Icon';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { useConfirmDiscard } from '@/lib/useConfirmDiscard';
import { uploadWithProgress } from '@/lib/uploadWithProgress';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import { communityIcon } from '@/constants/topicIcons';
import { TAG_OPTIONS } from '@/constants/tags';
import ActionSheet from '@/components/ActionSheet';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import type { Community } from '@/types';

type Route = RouteProp<RootStackParamList, 'CreatePost'>;

const MAX_VIDEO_SECONDS = 60;

async function uploadFile(
  bucket: string, uri: string, userId: string, fallbackExt: string, mimePrefix: string,
  onProgress: (fraction: number) => void
): Promise<string> {
  const ext = uri.split('.').pop()?.toLowerCase() || fallbackExt;
  const path = `${userId}/${Date.now()}.${ext}`;
  const arrayBuffer = await fetch(uri).then((r) => r.arrayBuffer());
  const contentType = ext === 'jpg' ? `${mimePrefix}/jpeg` : ext === 'mov' ? `${mimePrefix}/quicktime` : `${mimePrefix}/${ext}`;
  await uploadWithProgress(bucket, path, arrayBuffer, contentType, onProgress);
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// Drag to scrub through the clip and pick which frame becomes the post's
// cover — dx-based (not locationX-based) so a drag stays correct even once
// the finger moves outside the track's own bounds, same pattern as
// SwipeToAction's offset tracking.
function CoverScrubber({
  colors, durationMs, initialFraction, onSeek,
}: {
  colors: ColorTokens; durationMs: number; initialFraction: number; onSeek: (ms: number) => void;
}) {
  const styles = useMemo(() => createScrubberStyles(colors), [colors]);
  const [trackWidth, setTrackWidth] = useState(1);
  const [fraction, setFraction] = useState(initialFraction);
  const fractionRef = useRef(initialFraction);
  const startFractionRef = useRef(initialFraction);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { startFractionRef.current = fractionRef.current; },
      onPanResponderMove: (_, gesture) => {
        const next = Math.min(1, Math.max(0, startFractionRef.current + gesture.dx / trackWidth));
        fractionRef.current = next;
        setFraction(next);
      },
      onPanResponderRelease: () => onSeek(Math.round(fractionRef.current * durationMs)),
    })
  ).current;

  return (
    <View
      style={styles.track}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      {...panResponder.panHandlers}
    >
      <View style={styles.trackBg} />
      <View style={[styles.trackFill, { width: `${fraction * 100}%` }]} />
      <View style={[styles.thumb, { left: `${fraction * 100}%` }]} />
    </View>
  );
}

function createScrubberStyles(colors: ColorTokens) {
  return StyleSheet.create({
    track: { height: 28, justifyContent: 'center' },
    trackBg: { height: 4, borderRadius: 2, backgroundColor: colors.sandDeep },
    trackFill: { position: 'absolute', left: 0, height: 4, borderRadius: 2, backgroundColor: colors.coral },
    thumb: {
      position: 'absolute', width: 16, height: 16, borderRadius: 8, marginLeft: -8,
      backgroundColor: colors.coral, borderWidth: 2, borderColor: colors.white,
    },
  });
}

export default function CreatePostScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { session } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tag, setTag] = useState(TAG_OPTIONS[0]);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoDurationMs, setVideoDurationMs] = useState<number | null>(null);
  const [coverTimeMs, setCoverTimeMs] = useState(100);
  const [regeneratingCover, setRegeneratingCover] = useState(false);
  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [communityId, setCommunityId] = useState<string | null>(route.params?.communityId ?? null);
  const [publishing, setPublishing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  const [mediaPickerVisible, setMediaPickerVisible] = useState(false);

  const allowLeave = useConfirmDiscard(!posted && (title.trim() !== '' || body.trim() !== '' || imageUri !== null || videoUri !== null));

  // Only communities the user has joined can be posted into (enforced again,
  // for real, by the insert RLS policy — this list is just what to offer).
  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;
    supabase.from('community_members').select('community:communities(*)').eq('user_id', userId)
      .then(({ data }) => setMyCommunities(((data ?? []) as unknown as { community: Community }[]).map((r) => r.community)));
  }, [session]);

  const handlePickerResult = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) return;
    const asset = result.assets[0];

    if (asset.type === 'video') {
      if (asset.duration && asset.duration > MAX_VIDEO_SECONDS * 1000) {
        setError(`Videos can be up to ${MAX_VIDEO_SECONDS} seconds, and that one's longer.`);
        return;
      }
      setError(null);
      try {
        // time: 0 exactly can fail to decode on some codecs where the very
        // first frame isn't a keyframe — a small positive offset avoids that.
        const thumbnail = await VideoThumbnails.getThumbnailAsync(asset.uri, { time: 100 });
        setVideoUri(asset.uri);
        setImageUri(thumbnail.uri);
        setVideoDurationMs(asset.duration ?? null);
        setCoverTimeMs(100);
      } catch {
        setError('Couldn\'t process that video. Try a different one.');
      }
    } else {
      setError(null);
      setVideoUri(null);
      setVideoDurationMs(null);
      setImageUri(asset.uri);
    }
  };

  const handleCoverSeek = async (ms: number) => {
    if (!videoUri) return;
    setCoverTimeMs(ms);
    setRegeneratingCover(true);
    try {
      const thumbnail = await VideoThumbnails.getThumbnailAsync(videoUri, { time: Math.max(0, ms) });
      setImageUri(thumbnail.uri);
    } catch {
      // Some frames (e.g. right at the very end) can fail to decode — just
      // keep whatever cover was already showing rather than erroring out.
    } finally {
      setRegeneratingCover(false);
    }
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
      videoMaxDuration: MAX_VIDEO_SECONDS,
    });
    await handlePickerResult(result);
  };

  const captureFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera access is off for Havenly. Turn it on in your phone\'s Settings to take a photo or video.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
      videoMaxDuration: MAX_VIDEO_SECONDS,
    });
    await handlePickerResult(result);
  };

  const pickMedia = () => setMediaPickerVisible(true);

  const publish = async () => {
    setError(null);
    if (!session?.user) return;
    if (!title.trim()) { setError('Give your post a title.'); return; }

    setPublishing(true);
    try {
      let imageUrl: string | null = null;
      let videoUrl: string | null = null;

      if (imageUri) {
        setUploadStatus(videoUri ? 'Uploading thumbnail…' : 'Uploading photo…');
        setUploadProgress(0);
        imageUrl = await uploadFile('post-images', imageUri, session.user.id, 'jpg', 'image', setUploadProgress);
      }
      if (videoUri) {
        setUploadStatus('Uploading video…');
        setUploadProgress(0);
        videoUrl = await uploadFile('post-videos', videoUri, session.user.id, 'mp4', 'video', setUploadProgress);
      }

      const { error: insertError } = await supabase.from('posts').insert({
        author_id: session.user.id,
        title: title.trim(),
        body: body.trim() || null,
        tag,
        image_url: imageUrl,
        video_url: videoUrl,
        community_id: communityId,
      });
      if (insertError) throw insertError;

      haptics.success();
      setPosted(true);
      allowLeave();
      navigation.goBack();
      showToast('Posted!');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to publish post.');
    } finally {
      setPublishing(false);
      setUploadStatus(null);
      setUploadProgress(0);
    }
  };

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={styles.header}>
        <AnimatedPressable onPress={() => navigation.goBack()} accessibilityLabel="Cancel"><Text style={styles.headerBtn}>Cancel</Text></AnimatedPressable>
        <Text style={styles.headerTitle}>New post</Text>
        <AnimatedPressable onPress={publish} disabled={publishing} accessibilityLabel="Publish post">
          {publishing ? <ActivityIndicator color={colors.coral} /> : <Text style={[styles.headerBtn, styles.postBtn]}>Post</Text>}
        </AnimatedPressable>
      </View>
      {uploadStatus && (
        <View style={styles.progressWrap}>
          <Text style={styles.uploadStatus}>{uploadStatus} {Math.round(uploadProgress * 100)}%</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(4, uploadProgress * 100)}%` }]} />
          </View>
        </View>
      )}

      <AnimatedPressable onPress={pickMedia} style={styles.imagePicker} accessibilityLabel="Add a photo or video">
        {imageUri ? (
          <>
            <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
            {videoUri && (
              <View style={styles.playBadge}><Icon name="play" size={16} color="white" /></View>
            )}
            {regeneratingCover && (
              <View style={styles.coverLoading}><ActivityIndicator color="white" /></View>
            )}
          </>
        ) : (
          <Text style={styles.imagePickerText}>+ Add a photo or video</Text>
        )}
      </AnimatedPressable>

      {videoUri && videoDurationMs != null && videoDurationMs > 0 && (
        <View style={styles.scrubberSection}>
          <Text style={styles.sectionLabel}>Cover</Text>
          <CoverScrubber
            colors={colors}
            durationMs={videoDurationMs}
            initialFraction={coverTimeMs / videoDurationMs}
            onSeek={handleCoverSeek}
          />
        </View>
      )}

      <TextInput
        style={styles.titleInput}
        placeholder="Give it a title…"
        placeholderTextColor={colors.inkSoft}
        value={title}
        onChangeText={setTitle}
        maxLength={120}
      />
      <TextInput
        style={styles.bodyInput}
        placeholder="Say more (optional)…"
        placeholderTextColor={colors.inkSoft}
        value={body}
        onChangeText={setBody}
        multiline
      />

      <Text style={styles.sectionLabel}>Topic</Text>
      <View style={styles.chipGrid}>
        {TAG_OPTIONS.map((opt) => {
          const isSelected = tag === opt;
          return (
            <AnimatedPressable key={opt} style={[styles.chip, isSelected && styles.chipSelected]} onPress={() => { haptics.tap(); setTag(opt); }}>
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{opt}</Text>
            </AnimatedPressable>
          );
        })}
      </View>

      {myCommunities.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Post to</Text>
          <View style={styles.chipGrid}>
            <AnimatedPressable style={[styles.chip, !communityId && styles.chipSelected]} onPress={() => setCommunityId(null)}>
              <Text style={[styles.chipText, !communityId && styles.chipTextSelected]}>Just Feed</Text>
            </AnimatedPressable>
            {myCommunities.map((c) => {
              const isSelected = communityId === c.id;
              return (
                <AnimatedPressable key={c.id} style={[styles.chip, styles.chipWithIcon, isSelected && styles.chipSelected]} onPress={() => setCommunityId(c.id)}>
                  <Icon name={communityIcon(c)} size={12} color={isSelected ? colors.sand : colors.ink} />
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{c.name}</Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
    <ActionSheet
      visible={mediaPickerVisible}
      onClose={() => setMediaPickerVisible(false)}
      title="Add to your post"
      actions={[
        { label: 'Take Photo or Video', onPress: captureFromCamera },
        { label: 'Choose from Library', onPress: pickFromLibrary },
      ]}
    />
    </>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: 60, paddingBottom: spacing.md,
  },
  headerTitle: { fontFamily: 'Fraunces_600SemiBold', fontSize: 17, color: colors.ink },
  headerBtn: { fontSize: 14, fontWeight: '600', color: colors.inkSoft },
  postBtn: { color: colors.coral, fontWeight: '700' },
  progressWrap: { paddingHorizontal: spacing.lg, marginBottom: 12, gap: 6 },
  uploadStatus: { fontSize: 12, color: colors.inkSoft, textAlign: 'center' },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.sandDeep, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: colors.coral },
  imagePicker: {
    height: 200, marginHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.sandDeep,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, overflow: 'hidden',
  },
  imagePickerText: { color: colors.inkSoft, fontWeight: '600' },
  playBadge: {
    position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  coverLoading: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  scrubberSection: { marginTop: spacing.sm },
  titleInput: {
    marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.white, borderWidth: 1,
    borderColor: colors.line, borderRadius: radius.sm, padding: 14, fontSize: 15, fontWeight: '600', color: colors.ink,
  },
  bodyInput: {
    marginHorizontal: spacing.lg, marginTop: spacing.sm, minHeight: 90, backgroundColor: colors.white, borderWidth: 1,
    borderColor: colors.line, borderRadius: radius.sm, padding: 14, fontSize: 14, color: colors.ink, textAlignVertical: 'top',
  },
  sectionLabel: {
    fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, textTransform: 'uppercase', color: colors.inkSoft,
    fontWeight: '600', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 10,
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, paddingHorizontal: spacing.lg },
  chip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white },
  chipWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 12.5, fontWeight: '600', color: colors.ink },
  chipTextSelected: { color: colors.sand },
  error: { color: colors.coral, fontSize: 13, marginTop: 16, marginHorizontal: spacing.lg },
  });
}
