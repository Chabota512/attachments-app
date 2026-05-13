import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp, SavedEvent } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const STATUS_COLORS: Record<string, string> = {
  Interested: '#6b7280',
  Applied: '#3b82f6',
  Interviewing: '#a855f7',
  Offer: '#10b981',
  Rejected: '#ef4444',
  Accepted: '#f59e0b',
};

function daysUntil(dateStr: string) {
  return (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
}

function formatDate(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

function isThisWeek(isoDate: string) {
  return (Date.now() - new Date(isoDate).getTime()) < 7 * 24 * 60 * 60 * 1000;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, applications, contacts, savedEvents, unsaveEvent, updateProfile } = useApp();
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  const stats = useMemo(() => ({
    total: applications.length,
    applied: applications.filter(a => a.status === 'Applied').length,
    interviewing: applications.filter(a => a.status === 'Interviewing').length,
    offers: applications.filter(a => a.status === 'Offer' || a.status === 'Accepted').length,
  }), [applications]);

  const urgentDeadlines = useMemo(() =>
    applications
      .filter(a => a.deadline && daysUntil(a.deadline) <= 7)
      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
  , [applications]);

  const recentApps = useMemo(() =>
    [...applications]
      .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
      .slice(0, 4)
  , [applications]);

  const weeklyGoal = profile?.weeklyGoal ?? 5;
  const appsThisWeek = useMemo(() =>
    applications.filter(a => isThisWeek(a.createdDate || a.lastModified)).length
  , [applications]);
  const goalProgress = Math.min(appsThisWeek / weeklyGoal, 1);
  const followUpContacts = contacts.filter(c => c.needsFollowUp).length;

  const handleSaveGoal = async () => {
    const num = parseInt(goalInput, 10);
    if (!isNaN(num) && num > 0 && profile) {
      await updateProfile({ ...profile, weeklyGoal: num });
    }
    setEditingGoal(false);
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 72 : insets.bottom + 56;
  const s = styles(colors);

  const statItems = [
    { label: 'Tracked', value: stats.total, icon: 'briefcase' as const, color: colors.primary, bg: colors.indigoBg, border: colors.indigoBorder, route: '/(tabs)/applications' as const },
    { label: 'Applied', value: stats.applied, icon: 'send' as const, color: colors.blue, bg: colors.blueBg, border: colors.blueBorder, route: '/(tabs)/applications' as const },
    { label: 'Interviews', value: stats.interviewing, icon: 'message-circle' as const, color: colors.purple, bg: colors.purpleBg, border: colors.purpleBorder, route: '/(tabs)/applications' as const },
    { label: 'Offers', value: stats.offers, icon: 'check-circle' as const, color: colors.success, bg: colors.successBg, border: colors.successBorder, route: '/(tabs)/applications' as const },
  ];

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={{ paddingTop: topPad + 24, paddingBottom: bottomPad + 24 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.greeting}>{getGreeting()},</Text>
          <Text style={s.name}>{profile?.displayName?.split(' ')[0] || 'there'}</Text>
          {profile?.currentDegree ? (
            <Text style={s.degreeTag}>{profile.currentDegree}</Text>
          ) : (
            <Pressable
              onPress={() => router.push('/(tabs)/profile')}
              accessibilityLabel="Set your degree in Profile"
              accessibilityRole="button"
            >
              <Text style={[s.degreeTag, { color: colors.warning }]}>
                Tap to set your degree →
              </Text>
            </Pressable>
          )}
        </View>
        <Pressable
          style={s.avatarBtn}
          onPress={() => router.push('/(tabs)/profile')}
          accessibilityLabel="Open profile"
          accessibilityRole="button"
          android_ripple={{ color: colors.muted, borderless: true, radius: 22 }}
        >
          <Text style={s.avatarText}>{profile?.displayName?.[0]?.toUpperCase() || 'Y'}</Text>
        </Pressable>
      </View>

      {/* Stats Grid */}
      <View style={s.statsGrid}>
        {statItems.map(stat => (
          <Pressable
            key={stat.label}
            style={({ pressed }) => [s.statCard, pressed && { opacity: 0.85 }]}
            onPress={() => router.push(stat.route)}
            accessibilityLabel={`${stat.value} ${stat.label}`}
            accessibilityRole="button"
            android_ripple={{ color: stat.bg, borderless: false }}
          >
            <View style={[s.statIconBg, { backgroundColor: stat.bg, borderColor: stat.border }]}>
              <Feather name={stat.icon} size={16} color={stat.color} />
            </View>
            <Text style={[s.statValue, { color: stat.color }]}>{stat.value}</Text>
            <Text style={s.statLabel}>{stat.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Weekly Goal */}
      <View style={s.goalCard}>
        <View style={s.goalHeader}>
          <View style={[s.goalIconBg]}>
            <Feather name="target" size={15} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.goalTitle}>Weekly Goal</Text>
            <Text style={s.goalSub}>
              <Text style={{ color: goalProgress >= 1 ? colors.success : colors.text, fontFamily: 'Inter_700Bold' }}>
                {appsThisWeek}
              </Text>
              {' '}of {weeklyGoal} applications this week
            </Text>
          </View>
          <Pressable
            onPress={() => { setGoalInput(String(weeklyGoal)); setEditingGoal(true); }}
            style={s.goalEditBtn}
            accessibilityLabel="Edit weekly goal"
            accessibilityRole="button"
            android_ripple={{ color: colors.muted, borderless: true, radius: 18 }}
          >
            <Feather name="edit-2" size={15} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Progress bar */}
        <View style={s.progressTrack}>
          <View style={[
            s.progressFill,
            { width: `${Math.round(goalProgress * 100)}%` as any },
            goalProgress >= 1 ? { backgroundColor: colors.success } : { backgroundColor: colors.primary },
          ]} />
        </View>
        <View style={s.progressLabels}>
          <Text style={s.progressPct}>{Math.round(goalProgress * 100)}%</Text>
          {goalProgress >= 1 && (
            <View style={s.goalCompletePill}>
              <Feather name="check" size={10} color={colors.success} />
              <Text style={s.goalCompleteText}>Goal reached!</Text>
            </View>
          )}
        </View>

        {editingGoal && (
          <View style={s.goalEditRow}>
            <Text style={s.goalEditLabel}>Weekly target:</Text>
            <TextInput
              value={goalInput}
              onChangeText={setGoalInput}
              keyboardType="number-pad"
              style={s.goalInput}
              autoFocus
              maxLength={2}
              selectTextOnFocus
              accessibilityLabel="Weekly goal number"
            />
            <Pressable
              style={s.goalSaveBtn}
              onPress={handleSaveGoal}
              accessibilityRole="button"
              accessibilityLabel="Save weekly goal"
            >
              <Text style={s.goalSaveBtnText}>Save</Text>
            </Pressable>
            <Pressable onPress={() => setEditingGoal(false)} accessibilityRole="button" accessibilityLabel="Cancel">
              <Text style={[s.goalSaveBtnText, { color: colors.textMuted }]}>Cancel</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Urgent Deadlines */}
      {urgentDeadlines.length > 0 && (
        <View style={s.urgentCard}>
          <View style={s.urgentHeader}>
            <Feather name="alert-circle" size={14} color={colors.warning} />
            <Text style={s.urgentTitle}>Deadlines This Week</Text>
          </View>
          {urgentDeadlines.map(app => {
            const days = daysUntil(app.deadline!);
            const isPast = days < 0;
            return (
              <Pressable
                key={app.id}
                style={s.urgentRow}
                onPress={() => router.push('/(tabs)/applications')}
                accessibilityRole="button"
                accessibilityLabel={`${app.companyName} deadline ${isPast ? 'passed' : `in ${Math.ceil(days)} days`}`}
                android_ripple={{ color: colors.warningBg }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.urgentCompany}>{app.companyName}</Text>
                  <Text style={s.urgentRole} numberOfLines={1}>{app.role}</Text>
                </View>
                <View style={[s.urgentBadge, { backgroundColor: isPast ? colors.dangerBg : colors.warningBg, borderColor: isPast ? colors.dangerBorder : colors.warningBorder }]}>
                  <Text style={[s.urgentBadgeText, { color: isPast ? colors.danger : colors.warning }]}>
                    {isPast ? 'Passed' : days < 1 ? 'Today' : `${Math.ceil(days)}d`}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Recent Applications */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Recent Applications</Text>
        <Pressable
          onPress={() => router.push('/(tabs)/applications')}
          accessibilityRole="button"
          accessibilityLabel="View all applications"
        >
          <Text style={s.viewAll}>View all</Text>
        </Pressable>
      </View>

      {recentApps.length === 0 ? (
        <View style={s.emptyCard}>
          <View style={s.emptyIconBg}>
            <Feather name="inbox" size={28} color={colors.primary} />
          </View>
          <Text style={s.emptyTitle}>No applications yet</Text>
          <Text style={s.emptySubtitle}>Start tracking your WIL placement applications here.</Text>
          <Pressable
            style={s.emptyBtn}
            onPress={() => router.push('/(tabs)/applications')}
            accessibilityRole="button"
            accessibilityLabel="Add your first application"
            android_ripple={{ color: colors.indigoBg }}
          >
            <Feather name="plus" size={15} color={colors.primary} />
            <Text style={s.emptyBtnText}>Add your first one</Text>
          </Pressable>
        </View>
      ) : (
        recentApps.map(app => {
          const dotColor = STATUS_COLORS[app.status] || colors.textMuted;
          return (
            <Pressable
              key={app.id}
              style={({ pressed }) => [s.appCard, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/(tabs)/applications')}
              accessibilityRole="button"
              accessibilityLabel={`${app.companyName}, ${app.role}, status ${app.status}`}
              android_ripple={{ color: colors.muted, borderless: false }}
            >
              <View style={[s.appInitial, { backgroundColor: colors.indigoBg }]}>
                <Text style={[s.appInitialText, { color: colors.primary }]}>{app.companyName[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.appCompany} numberOfLines={1}>{app.companyName}</Text>
                <Text style={s.appRole} numberOfLines={1}>{app.role}</Text>
              </View>
              <View style={s.appRight}>
                <View style={[s.statusPill, { backgroundColor: `${dotColor}22` }]}>
                  <View style={[s.statusDot, { backgroundColor: dotColor }]} />
                  <Text style={[s.statusText, { color: dotColor }]}>{app.status}</Text>
                </View>
                <Text style={s.appDate}>{formatDate(app.lastModified)}</Text>
              </View>
            </Pressable>
          );
        })
      )}

      {/* Saved Events */}
      {savedEvents.length > 0 && (
        <>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Saved Events</Text>
            <Pressable
              onPress={() => router.push('/(tabs)/contacts')}
              accessibilityRole="button"
              accessibilityLabel="View all networking events"
            >
              <Text style={s.viewAll}>Browse more</Text>
            </Pressable>
          </View>
          {savedEvents.slice(0, 3).map((event: SavedEvent) => {
            const TYPE_COLORS: Record<string, { color: string; bg: string; border: string }> = {
              'career-expo': { color: '#6366f1', bg: 'rgba(99,102,241,0.14)', border: 'rgba(99,102,241,0.25)' },
              'event':       { color: '#3b82f6', bg: 'rgba(59,130,246,0.14)', border: 'rgba(59,130,246,0.25)' },
              'meetup':      { color: '#10b981', bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.25)' },
              'conference':  { color: '#f59e0b', bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.25)' },
              'trade-fair':  { color: '#a855f7', bg: 'rgba(168,85,247,0.14)', border: 'rgba(168,85,247,0.25)' },
              'workshop':    { color: '#14b8a6', bg: 'rgba(20,184,166,0.14)', border: 'rgba(20,184,166,0.25)' },
            };
            const meta = TYPE_COLORS[event.eventType] ?? TYPE_COLORS['event'];
            return (
              <View key={event.id} style={s.savedEventCard}>
                <View style={s.savedEventLeft}>
                  <View style={[s.savedEventTypeDot, { backgroundColor: meta.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.savedEventTitle} numberOfLines={1}>{event.title}</Text>
                    <Text style={s.savedEventMeta} numberOfLines={1}>
                      {event.dateLabel ? `${event.dateLabel}  ·  ` : ''}{event.location}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => unsaveEvent(event.id)}
                  style={s.savedEventUnsave}
                  accessibilityLabel="Remove saved event"
                  accessibilityRole="button"
                >
                  <Feather name="bookmark" size={15} color={meta.color} />
                </Pressable>
              </View>
            );
          })}
          {savedEvents.length > 3 && (
            <Pressable
              style={s.savedEventMore}
              onPress={() => router.push('/(tabs)/contacts')}
              accessibilityRole="button"
            >
              <Text style={s.savedEventMoreText}>+{savedEvents.length - 3} more saved events</Text>
              <Feather name="chevron-right" size={14} color={colors.primary} />
            </Pressable>
          )}
        </>
      )}

      {/* Quick Actions */}
      <Text style={[s.sectionTitle, { marginTop: 24, marginBottom: 14 }]}>Quick Actions</Text>
      <View style={s.quickRow}>
        <Pressable
          style={({ pressed }) => [s.quickCard, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/(tabs)/companies')}
          accessibilityRole="button"
          accessibilityLabel="Find WIL placements"
          android_ripple={{ color: colors.indigoBg }}
        >
          <View style={[s.quickIconBg, { backgroundColor: colors.indigoBg, borderColor: colors.indigoBorder }]}>
            <Feather name="compass" size={22} color={colors.primary} />
          </View>
          <Text style={s.quickTitle}>Find WIL{'\n'}Placements</Text>
          <Text style={s.quickSub}>AI-powered discovery</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [s.quickCard, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/(tabs)/contacts')}
          accessibilityRole="button"
          accessibilityLabel={`Network tab${followUpContacts > 0 ? `, ${followUpContacts} to follow up` : ''}`}
          android_ripple={{ color: colors.blueBg }}
        >
          <View style={[s.quickIconBg, { backgroundColor: colors.blueBg, borderColor: colors.blueBorder }]}>
            <Feather name="radio" size={22} color={colors.blue} />
          </View>
          <Text style={s.quickTitle}>Networking{'\n'}Events</Text>
          <Text style={s.quickSub}>
            {savedEvents.length > 0
              ? `${savedEvents.length} saved event${savedEvents.length !== 1 ? 's' : ''}`
              : 'Find events near you'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 },
  greeting: { fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginBottom: 2 },
  name: { fontSize: 30, fontFamily: 'Inter_700Bold', color: colors.text, letterSpacing: -0.8, lineHeight: 36 },
  degreeTag: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.textMuted, marginTop: 6 },
  avatarBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.indigoBg, borderWidth: 2, borderColor: colors.indigoBorder, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  avatarText: { fontSize: 18, fontFamily: 'Inter_700Bold', color: colors.primary },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, minWidth: '44%', backgroundColor: colors.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 8 },
  statIconBg: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  statValue: { fontSize: 32, fontFamily: 'Inter_700Bold', letterSpacing: -1.5, lineHeight: 36 },
  statLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  goalCard: { backgroundColor: colors.card, borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  goalIconBg: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.indigoBg, borderWidth: 1, borderColor: colors.indigoBorder, alignItems: 'center', justifyContent: 'center' },
  goalTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: colors.text },
  goalSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginTop: 2 },
  goalEditBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.muted },
  progressTrack: { height: 10, backgroundColor: colors.muted, borderRadius: 5, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: 10, borderRadius: 5 },
  progressLabels: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressPct: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.textMuted },
  goalCompletePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.successBg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: colors.successBorder },
  goalCompleteText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.success },
  goalEditRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.divider },
  goalEditLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.textSecondary },
  goalInput: { backgroundColor: colors.muted, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.text, width: 54, textAlign: 'center', borderWidth: 1, borderColor: colors.borderStrong },
  goalSaveBtn: { backgroundColor: colors.indigoBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.indigoBorder },
  goalSaveBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.primary },
  urgentCard: { backgroundColor: colors.warningBg, borderRadius: 18, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: colors.warningBorder },
  urgentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  urgentTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.warning, textTransform: 'uppercase', letterSpacing: 0.8 },
  urgentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.warningBorder },
  urgentCompany: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.text },
  urgentRole: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginTop: 1 },
  urgentBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  urgentBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: colors.text, letterSpacing: -0.3 },
  viewAll: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.primary },
  emptyCard: { backgroundColor: colors.card, borderRadius: 20, padding: 32, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  emptyIconBg: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.indigoBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.indigoBorder, marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.text },
  emptySubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: colors.indigoBg, borderRadius: 12, borderWidth: 1, borderColor: colors.indigoBorder, marginTop: 4 },
  emptyBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.primary },
  appCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  appInitial: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  appInitialText: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  appCompany: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.text },
  appRole: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginTop: 2 },
  appRight: { alignItems: 'flex-end', gap: 5, flexShrink: 0 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  appDate: { fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.textMuted },
  quickRow: { flexDirection: 'row', gap: 10 },
  quickCard: { flex: 1, backgroundColor: colors.card, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: colors.border, gap: 10 },
  quickIconBg: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  quickTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: colors.text, lineHeight: 22 },
  quickSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textSecondary },
  savedEventCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border, gap: 10 },
  savedEventLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  savedEventTypeDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  savedEventTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.text, marginBottom: 3 },
  savedEventMeta: { fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.textMuted },
  savedEventUnsave: { padding: 6 },
  savedEventMore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginBottom: 8 },
  savedEventMoreText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.primary },
});
