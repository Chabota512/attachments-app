import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';
import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Platform, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

function TabBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <View style={{
      position: 'absolute', top: -4, right: -8,
      backgroundColor: '#ef4444', borderRadius: 8,
      minWidth: 16, height: 16, paddingHorizontal: 4,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#fff', fontSize: 9, fontFamily: 'Inter_700Bold' }}>
        {count > 9 ? '9+' : count}
      </Text>
    </View>
  );
}

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <Label>Dashboard</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="companies">
        <Icon sf={{ default: 'safari', selected: 'safari.fill' }} />
        <Label>Companies</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="applications">
        <Icon sf={{ default: 'list.bullet.rectangle', selected: 'list.bullet.rectangle.fill' }} />
        <Label>Applications</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="contacts">
        <Icon sf={{ default: 'network', selected: 'network' }} />
        <Label>Network</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: 'person', selected: 'person.fill' }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const { contacts } = useApp();
  const followUpCount = contacts.filter(c => c.needsFollowUp).length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          height: Platform.OS === 'web' ? 72 : 56,
          paddingBottom: Platform.OS === 'web' ? 8 : 4,
          paddingTop: 4,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
          ) : null,
        tabBarLabelStyle: {
          fontFamily: 'Inter_600SemiBold',
          fontSize: 10,
          letterSpacing: 0.2,
        },
        tabBarIconStyle: { marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarAccessibilityLabel: 'Dashboard tab',
          tabBarIcon: ({ color, size }) =>
            isIOS
              ? <SymbolView name="house.fill" tintColor={color} size={size} />
              : <Feather name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="companies"
        options={{
          title: 'Companies',
          tabBarAccessibilityLabel: 'Find companies tab',
          tabBarIcon: ({ color, size }) =>
            isIOS
              ? <SymbolView name="safari.fill" tintColor={color} size={size} />
              : <Feather name="compass" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="applications"
        options={{
          title: 'Applications',
          tabBarAccessibilityLabel: 'My applications tab',
          tabBarIcon: ({ color, size }) =>
            isIOS
              ? <SymbolView name="list.bullet.rectangle" tintColor={color} size={size} />
              : <Feather name="briefcase" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: 'Network',
          tabBarAccessibilityLabel: `Network tab${followUpCount > 0 ? `, ${followUpCount} need follow-up` : ''}`,
          tabBarBadge: followUpCount > 0 ? followUpCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#ef4444', fontSize: 9, minWidth: 15, height: 15 },
          tabBarIcon: ({ color, size }) =>
            isIOS
              ? <SymbolView name="dot.radiowaves.left.and.right" tintColor={color} size={size} />
              : <Feather name="radio" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarAccessibilityLabel: 'My profile tab',
          tabBarIcon: ({ color, size }) =>
            isIOS
              ? <SymbolView name="person" tintColor={color} size={size} />
              : <Feather name="user" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
