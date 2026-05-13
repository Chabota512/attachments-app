import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';

import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

interface CompanyResult {
  name: string;
  description: string;
  fitScore: 'Excellent Fit' | 'Strong Fit' | 'Good Fit';
  website?: string | null;
}

const FIT_META: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  'Excellent Fit': { color: '#10b981', bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.25)', icon: 'star' },
  'Strong Fit':    { color: '#6366f1', bg: 'rgba(99,102,241,0.14)', border: 'rgba(99,102,241,0.25)', icon: 'trending-up' },
  'Good Fit':      { color: '#3b82f6', bg: 'rgba(59,130,246,0.14)', border: 'rgba(59,130,246,0.25)', icon: 'thumbs-up' },
};

function getApiBase() {
  const d = process.env.EXPO_PUBLIC_DOMAIN;
  return d ? `https://${d}` : '';
}

async function getLocation(): Promise<{ latitude: number; longitude: number }> {
  if (Platform.OS === 'web') {
    return new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(
        p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
        reject,
      ),
    );
  }
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Location permission denied');
  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
}

export default function CompaniesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, applications, addApplication } = useApp();
  const [results, setResults] = useState<CompanyResult[]>([]);
  const [trackedNames, setTrackedNames] = useState<Set<string>>(new Set());

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 72 : insets.bottom + 56;

  const alreadyTracked = (name: string) =>
    applications.some(a => a.companyName.toLowerCase() === name.toLowerCase()) || trackedNames.has(name);

  const discoverMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.currentDegree) throw new Error('no-degree');
      const { latitude, longitude } = await getLocation();
      const res = await fetch(`${getApiBase()}/api/ai/discover-companies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude,
          longitude,
          degree: profile.currentDegree,
          institution: profile.institution,
          yearOfStudy: profile.yearOfStudy,
          skills: profile.skills,
          city: profile.city,
          preferredIndustries: profile.preferredIndustries,
          goals: profile.careerGoals,
        }),
      });
      if (!res.ok) throw new Error('api');
      return res.json() as Promise<CompanyResult[]>;
    },
    onSuccess: (data) => {
      setResults(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: Error) => {
      if (err.message === 'no-degree') {
        Alert.alert('Degree required', 'Please add your degree in Profile before discovering companies.');
      } else if (err.message === 'Location permission denied') {
        Alert.alert('Location needed', 'Career Compass needs your location to find nearby WIL placements.', [
          { text: 'OK' },
        ]);
      } else {
        Alert.alert('Could not scan', 'Check your internet connection and try again.');
      }
    },
  });

  const handleTrack = async (company: CompanyResult) => {
    if (alreadyTracked(company.name)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await addApplication({
      companyName: company.name,
      role: `WIL Placement – ${profile?.currentDegree || 'General'}`,
      status: 'Interested',
      researchSummary: undefined,
    });
    setTrackedNames(prev => new Set([...prev, company.name]));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const s = styles(colors);

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={{ paddingTop: topPad + 24, paddingBottom: bottomPad + 24 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Find WIL Placements</Text>
          <Text style={s.subtitle}>AI-powered discovery of South African companies offering Work-Integrated Learning.</Text>
        </View>
        <View style={s.flagTag}>
          <Text style={s.flagText}>🇿🇦</Text>
        </View>
      </View>

      {/* Degree chip */}
      {profile?.currentDegree ? (
        <View style={s.degreeChip}>
          <Feather name="book-open" size={13} color={colors.primary} />
          <Text style={s.degreeText} numberOfLines={1}>{profile.currentDegree}</Text>
        </View>
      ) : (
        <View style={[s.degreeChip, { backgroundColor: colors.warningBg, borderColor: colors.warningBorder }]}>
          <Feather name="alert-triangle" size={13} color={colors.warning} />
          <Text style={[s.degreeText, { color: colors.warning }]}>Add your degree in Profile first</Text>
        </View>
      )}

      {/* Scan Button */}
      <Pressable
        style={({ pressed }) => [s.scanBtn, pressed && { opacity: 0.9 }]}
        onPress={() => discoverMutation.mutate()}
        disabled={discoverMutation.isPending}
        accessibilityRole="button"
        accessibilityLabel={results.length > 0 ? 'Scan again for companies' : 'Start scanning for WIL placements'}
        android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
      >
        <LinearGradient
          colors={['#6366f1', '#4f46e5']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={s.scanBtnGradient}
        >
          {discoverMutation.isPending ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={s.scanBtnText}>Scanning South Africa…</Text>
            </>
          ) : (
            <>
              <Feather name="compass" size={20} color="#fff" />
              <Text style={s.scanBtnText}>{results.length > 0 ? 'Scan Again' : 'Start Scan'}</Text>
            </>
          )}
        </LinearGradient>
      </Pressable>

      {/* Results */}
      {results.length > 0 && (
        <>
          <View style={s.resultHeader}>
            <Text style={s.resultCount}>{results.length} companies found</Text>
            <Text style={s.resultHint}>Tap a card to visit their website · Track to add to Applications</Text>
          </View>

          {results.map((company, idx) => {
            const fit = FIT_META[company.fitScore] || FIT_META['Good Fit'];
            const tracked = alreadyTracked(company.name);
            return (
              <View key={idx} style={s.companyCard}>
                <View style={s.companyTop}>
                  <View style={[s.companyInitial, { backgroundColor: fit.bg, borderColor: fit.border }]}>
                    <Text style={[s.companyInitialText, { color: fit.color }]}>{company.name[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.companyName}>{company.name}</Text>
                    <View style={[s.fitBadge, { backgroundColor: fit.bg, borderColor: fit.border }]}>
                      <Feather name={fit.icon as any} size={10} color={fit.color} />
                      <Text style={[s.fitText, { color: fit.color }]}>{company.fitScore}</Text>
                    </View>
                  </View>
                </View>

                <Text style={s.companyDesc}>{company.description}</Text>

                <View style={s.companyActions}>
                  {company.website && (
                    <Pressable
                      style={s.websiteBtn}
                      onPress={() => Linking.openURL(company.website!)}
                      accessibilityRole="link"
                      accessibilityLabel={`Visit ${company.name} website`}
                      android_ripple={{ color: colors.indigoBg, borderless: false }}
                    >
                      <Feather name="external-link" size={13} color={colors.primary} />
                      <Text style={s.websiteText} numberOfLines={1}>{company.website.replace(/^https?:\/\//, '')}</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={[s.trackBtn, tracked && s.trackBtnDone]}
                    onPress={() => handleTrack(company)}
                    disabled={tracked}
                    accessibilityRole="button"
                    accessibilityLabel={tracked ? `${company.name} is already tracked` : `Track ${company.name}`}
                    accessibilityState={{ disabled: tracked }}
                    android_ripple={{ color: tracked ? colors.successBg : colors.indigoBg }}
                  >
                    <Feather
                      name={tracked ? 'check' : 'plus'}
                      size={14}
                      color={tracked ? colors.success : colors.primary}
                    />
                    <Text style={[s.trackBtnText, tracked && { color: colors.success }]}>
                      {tracked ? 'Tracked' : 'Track'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </>
      )}

      {/* Empty state */}
      {!discoverMutation.isPending && results.length === 0 && (
        <View style={s.emptyState}>
          <View style={s.emptyIconBg}>
            <Feather name="compass" size={32} color={colors.primary} />
          </View>
          <Text style={s.emptyTitle}>Ready to scan</Text>
          <Text style={s.emptySubtitle}>
            We'll identify South African companies offering WIL placements that match your degree — then let you track them directly.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  title: { fontSize: 30, fontFamily: 'Inter_700Bold', color: colors.text, letterSpacing: -0.8, marginBottom: 6 },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.textSecondary, lineHeight: 20 },
  flagTag: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  flagText: { fontSize: 20 },
  degreeChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.indigoBg, borderWidth: 1, borderColor: colors.indigoBorder, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20, alignSelf: 'flex-start' },
  degreeText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.primary, flexShrink: 1 },
  scanBtn: { borderRadius: 18, overflow: 'hidden', marginBottom: 28 },
  scanBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 20 },
  scanBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: 0.2 },
  resultHeader: { marginBottom: 16 },
  resultCount: { fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.text, marginBottom: 4 },
  resultHint: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textMuted },
  companyCard: { backgroundColor: colors.card, borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  companyTop: { flexDirection: 'row', gap: 14, marginBottom: 12, alignItems: 'center' },
  companyInitial: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, flexShrink: 0 },
  companyInitialText: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  companyName: { fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.text, marginBottom: 6, letterSpacing: -0.2 },
  fitBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, borderWidth: 1, alignSelf: 'flex-start' },
  fitText: { fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  companyDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textSecondary, lineHeight: 20, marginBottom: 14 },
  companyActions: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.divider },
  websiteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  websiteText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: colors.primary, flex: 1 },
  trackBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.indigoBg, borderRadius: 10, borderWidth: 1, borderColor: colors.indigoBorder },
  trackBtnDone: { backgroundColor: colors.successBg, borderColor: colors.successBorder },
  trackBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.primary },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 14 },
  emptyIconBg: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.indigoBg, borderWidth: 1, borderColor: colors.indigoBorder, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.text },
  emptySubtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.textMuted, textAlign: 'center', lineHeight: 22, maxWidth: 300 },
});
