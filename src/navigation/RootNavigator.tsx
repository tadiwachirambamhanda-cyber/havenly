import React, { useCallback, useMemo, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, DarkTheme, type NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { ColorTokens } from '@/theme/tokens';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import TabBar from '@/navigation/TabBar';
import LaunchAnimation from '@/components/LaunchAnimation';
import GuestBanner from '@/components/GuestBanner';

import OnboardingScreen from '@/screens/OnboardingScreen';
import InboxScreen from '@/screens/InboxScreen';
import ChatScreen from '@/screens/ChatScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import NotificationsScreen from '@/screens/NotificationsScreen';
import BlockedUsersScreen from '@/screens/BlockedUsersScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import ChangePasswordScreen from '@/screens/ChangePasswordScreen';
import GuideScreen from '@/screens/GuideScreen';
import StartGroupScreen from '@/screens/StartGroupScreen';
import EnquiryGroupScreen from '@/screens/EnquiryGroupScreen';
import JoinGroupScreen from '@/screens/JoinGroupScreen';
import HousemateBoardScreen from '@/screens/HousemateBoardScreen';
import MyHousemateCardScreen from '@/screens/MyHousemateCardScreen';
import HousemateReviewScreen from '@/screens/HousemateReviewScreen';
import EditProfileScreen from '@/screens/EditProfileScreen';
import HousingScreen from '@/screens/HousingScreen';
import ResidenceDetailScreen from '@/screens/ResidenceDetailScreen';
import HousingEnquiryScreen from '@/screens/HousingEnquiryScreen';
import HousingEnquirySentScreen from '@/screens/HousingEnquirySentScreen';
import MyEnquiriesScreen from '@/screens/MyEnquiriesScreen';
import ManageHousingScreen from '@/screens/ManageHousingScreen';
import AdminEnquiryScreen from '@/screens/AdminEnquiryScreen';
import EditResidenceScreen from '@/screens/EditResidenceScreen';
import SavedScreen from '@/screens/SavedScreen';
import SignInToContinueScreen from '@/screens/SignInToContinueScreen';
import LegalScreen from '@/screens/LegalScreen';
// v2 community screens (Lane C). Each file is a placeholder until Lane C builds it.
import CommunityScreen from '@/screens/CommunityScreen';
import CommunityDetailScreen from '@/screens/CommunityDetailScreen';
import CreatePostScreen from '@/screens/CreatePostScreen';
import PostDetailScreen from '@/screens/PostDetailScreen';
import EventDetailScreen from '@/screens/EventDetailScreen';
import PerksScreen from '@/screens/PerksScreen';
import PerkDetailScreen from '@/screens/PerkDetailScreen';
import ReviewQueueScreen from '@/screens/ReviewQueueScreen';
import ManageEventsScreen from '@/screens/ManageEventsScreen';
import ManagePerksScreen from '@/screens/ManagePerksScreen';

// Why a signed-out visitor is being asked to make an account (shown in SignInToContinue).
export type AccountReason = 'save' | 'enquire' | 'join' | 'login' | 'housemates';

export type RootStackParamList = {
  Onboarding: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Notifications: undefined;
  Chat: { conversationId: string; otherUserId?: string };
  BlockedUsers: undefined;
  Settings: undefined;
  ChangePassword: undefined;
  Guide: undefined;
  StartGroup: { residenceId: string };
  EnquiryGroup: { groupId: string };
  JoinGroup: undefined;
  HousemateBoard: { residenceId?: string } | undefined;
  MyHousemateCard: { residenceId?: string } | undefined;
  HousemateReview: undefined;
  EditProfile: undefined;
  PublicHousing: undefined;
  ResidenceDetail: { residenceId: string };
  SignInToContinue: { reason: AccountReason; residenceId?: string };
  HousingEnquiry: { residenceId: string; kind: 'question' | 'viewing'; groupId?: string };
  HousingEnquirySent: { residenceName: string; kind: 'question' | 'viewing'; moveIn: string; groupSize?: number };
  MyEnquiries: undefined;
  ManageHousing: undefined;
  AdminEnquiry: { enquiryId: string };
  EditResidence: { residenceId?: string };
  Legal: { doc: 'privacy' | 'terms' };
  Saved: undefined;
  Inbox: undefined;
  // v2 community (Lane C): placeholders until built.
  CommunityDetail: { communityId: string };
  CreatePost: { communityId?: string; residenceId?: string; area?: string } | undefined;
  PostDetail: { postId: string };
  EventDetail: { eventId: string };
  Perks: undefined;
  PerkDetail: { perkId: string };
  ReviewQueue: undefined;
  ManageEvents: undefined;
  ManagePerks: undefined;
};

// Three tabs (owner decision 2026-11-25): Saved and Inbox are screens opened from Housing, Community and Profile.
export type MainTabParamList = {
  Housing: { area?: string } | undefined;
  Community: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator initialRouteName="Housing" screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tab.Screen name="Housing" component={HousingScreen} />
      <Tab.Screen name="Community" component={CommunityScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function SplashLoading({ colors }: { colors: ColorTokens }) {
  return (
    <View style={[styles.splash, { backgroundColor: colors.sand }]}>
      <ActivityIndicator color={colors.coral} size="large" />
    </View>
  );
}

export default function RootNavigator() {
  const { session, profile, loading, isGuest } = useAuth();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  // Plays exactly once per app process (not on every subsequent sign-in) —
  // showLaunch starts true and never flips back, so it covers the initial
  // `loading` window without needing to coordinate its own fixed-length
  // animation against the real auth check's actual timing. If the auth
  // check is still running once the animation finishes, falls through to
  // the plain spinner below rather than blocking startup on a slow network.
  const [showLaunch, setShowLaunch] = useState(true);
  // Stable identity — LaunchAnimation's entrance effect depends on onFinish,
  // so a fresh closure here on every re-render (auth/profile resolving
  // mid-animation) would restart the splash sequence instead of letting it
  // play once.
  const handleLaunchFinish = useCallback(() => setShowLaunch(false), []);

  const navTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, background: colors.sand, card: colors.sand, text: colors.ink, border: colors.line, primary: colors.coral } };
  }, [scheme, colors]);

  if (showLaunch) return <LaunchAnimation onFinish={handleLaunchFinish} />;
  if (loading) return <SplashLoading colors={colors} />;
  // Right after signing in, `session` updates a render before `profile` does
  // (AuthContext fetches it separately, after the fact) — without this,
  // that gap reads as "signed in, no completed-onboarding profile yet" and
  // flashes the Onboarding screen for a moment before the real profile
  // loads in, even for a returning user.
  if (session && !profile) return <SplashLoading colors={colors} />;

  return (
    <View style={{ flex: 1 }}>
    {isGuest ? <GuestBanner /> : null}
    {/* In the demo the banner already covers the status bar area, so the screens below must not leave room for it again. */}
    <SafeAreaInsetsContext.Provider value={isGuest ? { ...insets, top: 0 } : insets}>
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          // Signed out: the real Housing screen first, then a listing (with its rent split), all
          // without an account. Saving and enquiring open SignInToContinue
          // (useRequireAccount). That sheet is the only place to make an account or log in:
          // the Housing screen's "Log in" opens it in log-in mode. There is no separate
          // login or sign-up screen.
          <>
            <Stack.Screen name="PublicHousing" component={HousingScreen} />
            <Stack.Screen name="Guide" component={GuideScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="ResidenceDetail" component={ResidenceDetailScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="SignInToContinue" component={SignInToContinueScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Legal" component={LegalScreen} options={{ presentation: 'card' }} />
          </>
        ) : !profile?.has_completed_onboarding ? (
          // Signed in, first-time user — onboarding only.
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          // Signed in, returning user — full app.
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="Saved" component={SavedScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="Inbox" component={InboxScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
            <Stack.Screen name="Guide" component={GuideScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="StartGroup" component={StartGroupScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="EnquiryGroup" component={EnquiryGroupScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="JoinGroup" component={JoinGroupScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="HousemateBoard" component={HousemateBoardScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="MyHousemateCard" component={MyHousemateCardScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="HousemateReview" component={HousemateReviewScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="ResidenceDetail" component={ResidenceDetailScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="HousingEnquiry" component={HousingEnquiryScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="HousingEnquirySent" component={HousingEnquirySentScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="MyEnquiries" component={MyEnquiriesScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="ManageHousing" component={ManageHousingScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="AdminEnquiry" component={AdminEnquiryScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="EditResidence" component={EditResidenceScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Legal" component={LegalScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="CommunityDetail" component={CommunityDetailScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="CreatePost" component={CreatePostScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="Perks" component={PerksScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="PerkDetail" component={PerkDetailScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="ReviewQueue" component={ReviewQueueScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="ManageEvents" component={ManageEventsScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="ManagePerks" component={ManagePerksScreen} options={{ presentation: 'card' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
    </SafeAreaInsetsContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
