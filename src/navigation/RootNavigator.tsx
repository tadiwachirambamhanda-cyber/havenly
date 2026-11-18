import React, { useCallback, useMemo, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme, type NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { ColorTokens } from '@/theme/tokens';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useStreakBump } from '@/lib/useStreakBump';
import TabBar from '@/navigation/TabBar';
import LaunchAnimation from '@/components/LaunchAnimation';
import GuestBanner from '@/components/GuestBanner';
import { PUBLIC_BROWSING } from '@/config/features';

import LoginScreen from '@/screens/LoginScreen';
import OnboardingScreen from '@/screens/OnboardingScreen';
import FeedScreen from '@/screens/FeedScreen';
import DiscoverScreen from '@/screens/DiscoverScreen';
import InboxScreen from '@/screens/InboxScreen';
import ChatScreen from '@/screens/ChatScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import UserProfileScreen from '@/screens/UserProfileScreen';
import NotificationsScreen from '@/screens/NotificationsScreen';
import SharePostScreen from '@/screens/SharePostScreen';
import PostDetailScreen from '@/screens/PostDetailScreen';
import CommunitiesScreen from '@/screens/CommunitiesScreen';
import CommunityDetailScreen from '@/screens/CommunityDetailScreen';
import CreatePostScreen from '@/screens/CreatePostScreen';
import CreateEventScreen from '@/screens/CreateEventScreen';
import BlockedUsersScreen from '@/screens/BlockedUsersScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import EditProfileScreen from '@/screens/EditProfileScreen';
import FollowListScreen from '@/screens/FollowListScreen';
import NewGroupScreen from '@/screens/NewGroupScreen';
import OffersScreen from '@/screens/OffersScreen';
import OfferDetailScreen from '@/screens/OfferDetailScreen';
import ManageBrandsScreen from '@/screens/ManageBrandsScreen';
import CreateOfferScreen from '@/screens/CreateOfferScreen';
import MapScreen from '@/screens/MapScreen';
import EventDetailScreen from '@/screens/EventDetailScreen';
import HousingScreen from '@/screens/HousingScreen';
import ResidenceDetailScreen from '@/screens/ResidenceDetailScreen';
import HousingEnquiryScreen from '@/screens/HousingEnquiryScreen';
import HousingEnquirySentScreen from '@/screens/HousingEnquirySentScreen';
import MyEnquiriesScreen from '@/screens/MyEnquiriesScreen';
import ManageHousingScreen from '@/screens/ManageHousingScreen';
import AdminEnquiryScreen from '@/screens/AdminEnquiryScreen';
import EditResidenceScreen from '@/screens/EditResidenceScreen';
import SplitRentScreen from '@/screens/SplitRentScreen';
import CompareScreen from '@/screens/CompareScreen';
import SignInToContinueScreen from '@/screens/SignInToContinueScreen';
import LegalScreen from '@/screens/LegalScreen';

// Why a signed-out visitor is being asked to make an account (shown in SignInToContinue).
export type AccountReason = 'save' | 'enquire' | 'compare' | 'join';

export type RootStackParamList = {
  Login: undefined;
  Onboarding: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  PostDetail: { postId: string };
  UserProfile: { userId: string };
  Notifications: undefined;
  SharePost: { postId: string };
  Chat: { conversationId: string; otherUserId?: string };
  NewGroup: undefined;
  Communities: undefined;
  CommunityDetail: { communityId: string };
  CreatePost: { communityId?: string } | undefined;
  CreateEvent: undefined;
  BlockedUsers: undefined;
  Settings: undefined;
  EditProfile: undefined;
  FollowList: { userId: string; initialTab: 'followers' | 'following'; displayName: string };
  Offers: undefined;
  OfferDetail: { offerId: string };
  ManageBrands: undefined;
  CreateOffer: undefined;
  Map: undefined;
  EventDetail: { eventId: string };
  PublicHousing: undefined;
  ResidenceDetail: { residenceId: string };
  SplitRent: { residenceId: string };
  Compare: undefined;
  SignInToContinue: { reason: AccountReason; residenceId?: string };
  HousingEnquiry: { residenceId: string; kind: 'question' | 'viewing' };
  HousingEnquirySent: { residenceName: string; kind: 'question' | 'viewing'; moveIn: string };
  MyEnquiries: undefined;
  ManageHousing: undefined;
  AdminEnquiry: { enquiryId: string };
  EditResidence: { residenceId?: string };
  Legal: { doc: 'privacy' | 'terms' };
};

export type MainTabParamList = {
  Housing: undefined;
  Discover: undefined;
  Feed: undefined;
  Inbox: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator initialRouteName="Housing" screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tab.Screen name="Housing" component={HousingScreen} />
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Inbox" component={InboxScreen} />
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
  useStreakBump();
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
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session && PUBLIC_BROWSING ? (
          // Signed out, public browsing on: the real Housing screen first, a listing and
          // the rent split without an account. Saving, enquiring and comparing open
          // SignInToContinue (useRequireAccount). That sheet is also the only place an account is
          // made (Login's "Create an account" link opens it with reason 'join'); Login stays for
          // people who already have one.
          <>
            <Stack.Screen name="PublicHousing" component={HousingScreen} />
            <Stack.Screen name="ResidenceDetail" component={ResidenceDetailScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="SplitRent" component={SplitRentScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="SignInToContinue" component={SignInToContinueScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Legal" component={LegalScreen} options={{ presentation: 'card' }} />
          </>
        ) : !session ? (
          // Signed out — auth flow only.
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
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
            <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="SharePost" component={SharePostScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="NewGroup" component={NewGroupScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Communities" component={CommunitiesScreen} />
            <Stack.Screen name="CommunityDetail" component={CommunityDetailScreen} />
            <Stack.Screen name="CreatePost" component={CreatePostScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="CreateEvent" component={CreateEventScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="FollowList" component={FollowListScreen} />
            <Stack.Screen name="Offers" component={OffersScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="OfferDetail" component={OfferDetailScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="ManageBrands" component={ManageBrandsScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="CreateOffer" component={CreateOfferScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Map" component={MapScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="ResidenceDetail" component={ResidenceDetailScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="SplitRent" component={SplitRentScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Compare" component={CompareScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="HousingEnquiry" component={HousingEnquiryScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="HousingEnquirySent" component={HousingEnquirySentScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="MyEnquiries" component={MyEnquiriesScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="ManageHousing" component={ManageHousingScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="AdminEnquiry" component={AdminEnquiryScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="EditResidence" component={EditResidenceScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Legal" component={LegalScreen} options={{ presentation: 'card' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
