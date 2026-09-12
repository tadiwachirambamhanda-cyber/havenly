import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '@/theme/tokens';
import { useAuth } from '@/lib/AuthContext';
import TabBar from '@/navigation/TabBar';

import LoginScreen from '@/screens/LoginScreen';
import SignUpScreen from '@/screens/SignUpScreen';
import OnboardingScreen from '@/screens/OnboardingScreen';
import FeedScreen from '@/screens/FeedScreen';
import DiscoverScreen from '@/screens/DiscoverScreen';
import InboxScreen from '@/screens/InboxScreen';
import ChatScreen from '@/screens/ChatScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import PostDetailScreen from '@/screens/PostDetailScreen';
import CommunitiesScreen from '@/screens/CommunitiesScreen';
import CommunityDetailScreen from '@/screens/CommunityDetailScreen';
import CreatePostScreen from '@/screens/CreatePostScreen';

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  Onboarding: undefined;
  MainTabs: undefined;
  PostDetail: { postId: string };
  Chat: { conversationId: string; otherUserName: string };
  Communities: undefined;
  CommunityDetail: { communityId: string };
  CreatePost: undefined;
};

export type MainTabParamList = {
  Feed: undefined;
  Discover: undefined;
  Inbox: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Inbox" component={InboxScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function SplashLoading() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator color={colors.coral} size="large" />
    </View>
  );
}

export default function RootNavigator() {
  const { session, profile, loading } = useAuth();

  if (loading) return <SplashLoading />;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          // Signed out — auth flow only.
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
          </>
        ) : !profile?.has_completed_onboarding ? (
          // Signed in, first-time user — onboarding only.
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          // Signed in, returning user — full app.
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="Communities" component={CommunitiesScreen} />
            <Stack.Screen name="CommunityDetail" component={CommunityDetailScreen} />
            <Stack.Screen name="CreatePost" component={CreatePostScreen} options={{ presentation: 'modal' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
});
