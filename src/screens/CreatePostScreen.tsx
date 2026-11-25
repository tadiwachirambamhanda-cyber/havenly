import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Text, TextInput } from '@/components/Text';
import Icon from '@/components/Icon';
import AnimatedPressable from '@/components/AnimatedPressable';
import ActionSheet from '@/components/ActionSheet';
import { Notice, StateBlock } from '@/components/housing/parts';
import TagPicker, { type PostTag } from '@/components/community/TagPicker';
import { BOLD, CardSkeletons, Content, GUTTER, Pill, TITLE_FONT } from '@/components/community/ui';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { MAX_PHOTOS, POST_MAX, communityInitials, friendlyError, photoSizeProblem, photoType, postProblem } from '@/lib/community';
import { createPost, fetchCommunities, fetchListingsForTag, fetchMyCommunityIds } from '@/lib/communityApi';
import { PhotoProblem, removePhotos, uploadPhotos, type PickedPhoto } from '@/lib/communityPhotos';
import type { Community } from '@/types';
import type { ColorTokens } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'CreatePost'>;

// New post (F19, F20): a sheet with the community, text, up to 4 photos and an optional area or listing tag.
// Photos go to the private community-photos store; a failed post keeps the text.
export default function CreatePostScreen() {
  const navigation = useNavigation<Nav>();
  const params = useRoute<Route>().params ?? {};
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const myId = session?.user.id;
  const { colors } = useTheme();
  const { showToast } = useToast();
  const s = useMemo(() => styles(colors), [colors]);

  const [mine, setMine] = useState<Community[] | null | 'failed'>(null);
  const [communityId, setCommunityId] = useState<string | null>(params.communityId ?? null);
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [tag, setTag] = useState<PostTag | null>(params.area ? { kind: 'area', area: params.area } : null);
  const [tagOpen, setTagOpen] = useState(false);
  const [communityOpen, setCommunityOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'posting'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!myId) return;
    let alive = true;
    Promise.all([fetchCommunities(), fetchMyCommunityIds(myId)])
      .then(([all, ids]) => {
        if (!alive) return;
        const joined = all.filter((c) => ids.includes(c.id));
        const uni = joined.find((c) => c.related_university && c.related_university === profile?.university);
        setMine(joined);
        setCommunityId((cur) => (cur && joined.some((c) => c.id === cur) ? cur : uni?.id ?? joined[0]?.id ?? null));
      })
      .catch(() => { if (alive) setMine('failed'); });
    return () => { alive = false; };
  }, [myId, profile?.university, attempt]);

  // Asked about a listing (from its page): show the listing's name on the tag.
  useEffect(() => {
    const residenceId = params.residenceId;
    if (!residenceId) return;
    let alive = true;
    fetchListingsForTag().then((l) => {
      const hit = l.find((x) => x.id === residenceId);
      if (alive && hit) setTag({ kind: 'listing', id: hit.id, name: hit.name, area: hit.area });
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [params.residenceId]);

  const community = Array.isArray(mine) ? mine.find((c) => c.id === communityId) ?? null : null;
  const busy = status !== 'idle';
  const canPost = !!body.trim() && !!communityId && !busy;

  const addPhotos = async () => {
    if (photos.length >= MAX_PHOTOS) { showToast(`You can add up to ${MAX_PHOTOS} photos.`); return; }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: MAX_PHOTOS - photos.length, quality: 0.8,
      });
      if (result.canceled) return;
      const picked: PickedPhoto[] = [];
      for (const a of result.assets) {
        if (!photoType(a.mimeType, a.uri) && !a.uri.startsWith('data:image/') && !a.uri.startsWith('blob:')) { showToast('Photos must be JPEG, PNG, WebP or HEIC.', 'error'); continue; }
        const big = photoSizeProblem(a.fileSize);
        if (big) { showToast(big, 'error'); continue; }
        picked.push({ uri: a.uri, mimeType: a.mimeType ?? null, fileSize: a.fileSize ?? null });
      }
      setPhotos((prev) => [...prev, ...picked].slice(0, MAX_PHOTOS));
    } catch {
      showToast('Couldn’t open your photos. Try again.', 'error');
    }
  };

  const submit = async () => {
    if (!myId) return;
    const problem = postProblem({ body, photoCount: photos.length, communityId });
    if (problem) { setError(problem); return; }
    setError(null);
    haptics.confirm();
    let paths: string[] = [];
    try {
      if (photos.length) {
        setStatus('uploading');
        paths = await uploadPhotos(myId, photos);
      }
      setStatus('posting');
      const postId = await createPost({
        userId: myId, communityId: communityId!, body, imagePaths: paths,
        area: tag?.kind === 'area' ? tag.area : null, residenceId: tag?.kind === 'listing' ? tag.id : null,
      });
      haptics.success();
      showToast('Posted.');
      navigation.goBack();
      void postId;
    } catch (e) {
      if (paths.length) await removePhotos(paths).catch(() => undefined);
      setError(e instanceof PhotoProblem ? e.message : friendlyError(e, 'Your post did not go up. Your text is still here, so try again.'));
      setStatus('idle');
    }
  };

  const pickedUri = (p: PickedPhoto) => p.uri;

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Content style={{ flex: 1 }}>
        <View style={[s.bar, { paddingTop: Platform.OS === 'web' ? insets.top + 12 : 12 }]}>
          <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" style={s.barBtn} disabled={busy}>
            <Text style={s.cancel}>Cancel</Text>
          </Pressable>
          <Text style={s.title} accessibilityRole="header">New post</Text>
          <Pill
            label={status === 'uploading' ? 'Uploading…' : status === 'posting' ? 'Posting…' : 'Post'}
            tone={canPost ? 'berry' : 'plain'} disabled={!canPost} onPress={submit} height={44}
            accessibilityLabel={canPost ? 'Post' : 'Post, write something first'}
          />
        </View>

        {mine === null ? <CardSkeletons count={2} height={110} /> : mine === 'failed' ? (
          <StateBlock icon="alert-circle" kind="error" title="We could not load your communities" body="Check your connection and try again."
            primary={{ label: 'Try again', onPress: () => { setMine(null); setAttempt((n) => n + 1); } }} />
        ) : mine.length === 0 ? (
          <StateBlock icon="users" title="Join a community first" body="Posts live inside communities. Join your university's community, then come back to post."
            primary={{ label: 'Back to Community', onPress: () => navigation.goBack() }} />
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: insets.bottom + 40, gap: 16 }} keyboardShouldPersistTaps="handled">
            <Pressable style={s.picker} onPress={() => setCommunityOpen(true)} accessibilityRole="button" accessibilityLabel={`Posting in ${community?.name ?? 'a community'}. Change`} disabled={busy}>
              <View style={s.badge}><Text style={s.badgeText}>{community ? communityInitials(community.name) : '?'}</Text></View>
              <Text style={s.pickerText} numberOfLines={2}>Posting in {community?.name ?? 'a community'}</Text>
              <Icon name="chevron-right" size={14} color={colors.inkSoft} />
            </Pressable>

            <TextInput
              value={body} onChangeText={(t) => { setBody(t); if (error) setError(null); }}
              placeholder="What do you want to ask or share?" placeholderTextColor={colors.fieldLine}
              multiline maxLength={POST_MAX} style={s.input} accessibilityLabel="Your post" editable={!busy} autoFocus
            />
            {body.length > POST_MAX - 200 ? <Text style={s.count}>{body.length} of {POST_MAX}</Text> : null}

            <View>
              <Text style={s.label}>Photos · {photos.length} of {MAX_PHOTOS}</Text>
              <View style={s.photos}>
                {photos.map((p, i) => (
                  <View key={`${p.uri}-${i}`} style={s.photo}>
                    <Image source={{ uri: pickedUri(p) }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    {!busy ? (
                      <AnimatedPressable style={s.remove} onPress={() => setPhotos((prev) => prev.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`}>
                        <Icon name="x" size={14} color="#FFFFFF" />
                      </AnimatedPressable>
                    ) : null}
                  </View>
                ))}
                {photos.length < MAX_PHOTOS ? (
                  <AnimatedPressable style={[s.photo, s.addPhoto]} onPress={addPhotos} disabled={busy} accessibilityRole="button" accessibilityLabel="Add photos">
                    <Icon name="camera" size={20} color={colors.inkSoft} />
                    <Text style={s.addText}>Add</Text>
                  </AnimatedPressable>
                ) : null}
              </View>
              {status === 'uploading' ? (
                <View style={s.uploading}><ActivityIndicator color={colors.coral} /><Text style={s.note}>Uploading your photos…</Text></View>
              ) : null}
            </View>

            <View style={{ gap: 8 }}>
              <Text style={s.label}>Tag an area or a listing · optional</Text>
              <View style={s.tagRow}>
                {tag ? (
                  <Pill
                    label={tag.kind === 'area' ? tag.area : tag.name} icon="map-pin" tone="mint" onPress={() => setTag(null)}
                    accessibilityLabel={`Tagged ${tag.kind === 'area' ? tag.area : tag.name}. Tap to remove`}
                  />
                ) : null}
                <Pill label={tag ? 'Change' : 'Choose an area or listing'} icon={tag ? undefined : 'plus'} onPress={() => setTagOpen(true)} disabled={busy} />
              </View>
              <Text style={s.note}>Tagged posts also show on that area’s listings, under “Students talking about this area”.</Text>
            </View>

            {error ? <Notice>{error}</Notice> : null}
            <Text style={s.footer}>Your name, photo and university show on your post. Anyone can report a post that breaks the community rules.</Text>
          </ScrollView>
        )}
      </Content>

      <TagPicker visible={tagOpen} onClose={() => setTagOpen(false)} onPick={(t) => { setTag(t); setTagOpen(false); }} />
      <ActionSheet
        visible={communityOpen}
        onClose={() => setCommunityOpen(false)}
        title="Post in"
        actions={(Array.isArray(mine) ? mine : []).map((c) => ({ label: c.id === communityId ? `${c.name} ✓` : c.name, onPress: () => setCommunityId(c.id) }))}
      />
    </KeyboardAvoidingView>
  );
}

function styles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: GUTTER, paddingBottom: 14, gap: 10 },
    barBtn: { minHeight: 44, justifyContent: 'center' },
    cancel: { fontFamily: BOLD, fontSize: 16, color: colors.coral },
    title: { fontFamily: TITLE_FONT, fontSize: 19, color: colors.ink },
    picker: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 12 },
    badge: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.coralFill, alignItems: 'center', justifyContent: 'center' },
    badgeText: { fontFamily: BOLD, fontSize: 13, color: '#FFFFFF' },
    pickerText: { flex: 1, fontFamily: BOLD, fontSize: 15, color: colors.ink },
    input: { minHeight: 150, fontSize: 17, lineHeight: 24, color: colors.ink, textAlignVertical: 'top', borderRadius: 22, borderWidth: 1, borderColor: colors.fieldLine, backgroundColor: colors.white, padding: 16 },
    count: { fontSize: 12, color: colors.inkSoft, textAlign: 'right' },
    label: { fontFamily: BOLD, fontSize: 14, color: colors.ink, marginBottom: 8 },
    photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    photo: { width: 84, height: 84, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.photo },
    addPhoto: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.fieldLine, gap: 2 },
    addText: { fontSize: 12, fontFamily: BOLD, color: colors.inkSoft },
    remove: { position: 'absolute', top: 4, right: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
    uploading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    note: { fontSize: 13, lineHeight: 18, color: colors.inkSoft },
    footer: { fontSize: 13, lineHeight: 18, color: colors.inkSoft, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14 },
  });
}
