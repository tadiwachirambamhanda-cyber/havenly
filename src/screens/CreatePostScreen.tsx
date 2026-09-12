import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { colors, radius, spacing } from '@/theme/tokens';

const TAG_OPTIONS = ['Cafés', 'Fashion', 'Nightlife', 'Fitness', 'Beach Days', 'Study Spots', 'Travel', 'Events', 'Padel', 'Beauty'];

export default function CreatePostScreen() {
  const navigation = useNavigation();
  const { session } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tag, setTag] = useState(TAG_OPTIONS[0]);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const publish = async () => {
    setError(null);
    if (!session?.user) return;
    if (!title.trim()) { setError('Give your post a title.'); return; }

    setPublishing(true);
    try {
      let imageUrl: string | null = null;
      if (imageUri) {
        const ext = imageUri.split('.').pop()?.toLowerCase() ?? 'jpg';
        const path = `${session.user.id}/${Date.now()}.${ext}`;
        const arrayBuffer = await fetch(imageUri).then((r) => r.arrayBuffer());
        const { error: uploadError } = await supabase.storage.from('post-images').upload(path, arrayBuffer, {
          contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        });
        if (uploadError) throw uploadError;
        imageUrl = supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl;
      }

      const { error: insertError } = await supabase.from('posts').insert({
        author_id: session.user.id,
        title: title.trim(),
        body: body.trim() || null,
        tag,
        image_url: imageUrl,
      });
      if (insertError) throw insertError;

      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to publish post.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}><Text style={styles.headerBtn}>Cancel</Text></Pressable>
        <Text style={styles.headerTitle}>New post</Text>
        <Pressable onPress={publish} disabled={publishing}>
          {publishing ? <ActivityIndicator color={colors.coral} /> : <Text style={[styles.headerBtn, styles.postBtn]}>Post</Text>}
        </Pressable>
      </View>

      <Pressable onPress={pickImage} style={styles.imagePicker}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Text style={styles.imagePickerText}>+ Add a photo</Text>
        )}
      </Pressable>

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
            <Pressable key={opt} style={[styles.chip, isSelected && styles.chipSelected]} onPress={() => setTag(opt)}>
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: 60, paddingBottom: spacing.md,
  },
  headerTitle: { fontFamily: 'Fraunces_600SemiBold', fontSize: 17, color: colors.ink },
  headerBtn: { fontSize: 14, fontWeight: '600', color: colors.inkSoft },
  postBtn: { color: colors.coral, fontWeight: '700' },
  imagePicker: {
    height: 200, marginHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.sandDeep,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, overflow: 'hidden',
  },
  imagePickerText: { color: colors.inkSoft, fontWeight: '600' },
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
  chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 12.5, fontWeight: '600', color: colors.ink },
  chipTextSelected: { color: colors.sand },
  error: { color: colors.coral, fontSize: 13, marginTop: 16, marginHorizontal: spacing.lg },
});
