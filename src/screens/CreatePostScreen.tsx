import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme/tokens';

// STUB — the "+" create-post flow. TODO(claude-code): implement actual image
// upload to Supabase Storage (bucket: `post-images`), topic-chip picker, and location tagging.

export default function CreatePostScreen() {
  const navigation = useNavigation();
  const [title, setTitle] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const publish = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !title.trim()) return;
    await supabase.from('posts').insert({ author_id: user.id, title, tag: 'General' });
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={pickImage} style={styles.imagePicker}><Text>{imageUri ? 'Change photo' : 'Add a photo'}</Text></Pressable>
      <TextInput style={styles.input} placeholder="What's on your mind?" value={title} onChangeText={setTitle} multiline />
      <Pressable style={styles.publishBtn} onPress={publish}><Text style={styles.publishText}>Publish</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand, padding: spacing.lg, paddingTop: 40 },
  imagePicker: { height: 160, borderRadius: 16, backgroundColor: colors.sandDeep, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, marginBottom: spacing.md },
  input: { minHeight: 100, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, fontSize: 14, textAlignVertical: 'top' },
  publishBtn: { marginTop: 20, backgroundColor: colors.coral, paddingVertical: 14, borderRadius: 100, alignItems: 'center' },
  publishText: { color: 'white', fontWeight: '700' },
});
