import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme/tokens';
import type { Post } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'PostDetail'>;

// STUB — port hero image, tag, title, author row + follow button, body text,
// and like/comment/share/save action bar from the HTML prototype's #detail screen.

export default function PostDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const [post, setPost] = useState<Post | null>(null);

  useEffect(() => {
    supabase.from('posts').select('*, author:profiles(*)').eq('id', route.params.postId).single()
      .then(({ data }) => setPost(data as unknown as Post));
  }, [route.params.postId]);

  return (
    <ScrollView style={styles.container}>
      <Pressable style={styles.back} onPress={() => navigation.goBack()}><Text>←</Text></Pressable>
      <View style={styles.body}>
        <Text style={styles.tag}>{post?.tag}</Text>
        <Text style={styles.title}>{post?.title}</Text>
        <Text style={styles.text}>{post?.body}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  back: { marginTop: 50, marginLeft: 16, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing.lg },
  tag: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 10.5, color: colors.teal, textTransform: 'uppercase' },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 22, color: colors.ink, marginTop: 8 },
  text: { fontSize: 13.5, color: '#3A4038', lineHeight: 22, marginTop: 14 },
});
