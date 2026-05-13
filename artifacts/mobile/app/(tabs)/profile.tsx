import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { genId, ProfileField, useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

function getFieldValue(fields: ProfileField[], ...keywords: string[]): string | undefined {
  for (const kw of keywords) {
    const lower = kw.toLowerCase();
    const match = fields.find(f => f.label.toLowerCase().includes(lower));
    if (match?.value?.trim()) return match.value.trim();
  }
  return undefined;
}

function FieldViewRow({
  field,
  isLast,
  colors,
}: {
  field: ProfileField;
  isLast?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{
      paddingVertical: 12,
      borderBottomWidth: isLast ? 0 : 1,
      borderBottomColor: 'rgba(255,255,255,0.06)',
    }}>
      <Text style={{
        fontSize: 10,
        fontFamily: 'Inter_600SemiBold',
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 3,
      }}>
        {field.label}
      </Text>
      <Text style={{
        fontSize: 14,
        fontFamily: 'Inter_500Medium',
        color: colors.text,
        lineHeight: 20,
      }}>
        {field.value}
      </Text>
    </View>
  );
}

function FieldEditRow({
  field,
  onChange,
  onDelete,
  colors,
}: {
  field: ProfileField;
  onChange: (id: string, key: 'label' | 'value', text: string) => void;
  onDelete: (id: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const inputBase = {
    backgroundColor: colors.muted,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14 as const,
    fontFamily: 'Inter_400Regular' as const,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  };
  return (
    <View style={{
      marginBottom: 12,
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <TextInput
          value={field.label}
          onChangeText={t => onChange(field.id, 'label', t)}
          placeholder="Field label (e.g. Internship at ABC)"
          placeholderTextColor={colors.textMuted}
          style={[inputBase, { flex: 1, fontSize: 12, fontFamily: 'Inter_600SemiBold' }]}
          returnKeyType="next"
        />
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onDelete(field.id); }}
          style={{
            width: 32, height: 32, borderRadius: 8,
            backgroundColor: colors.dangerBg,
            alignItems: 'center', justifyContent: 'center',
          }}
          accessibilityLabel="Delete field"
        >
          <Feather name="trash-2" size={14} color={colors.danger} />
        </Pressable>
      </View>
      <TextInput
        value={field.value}
        onChangeText={t => onChange(field.id, 'value', t)}
        placeholder="Value"
        placeholderTextColor={colors.textMuted}
        style={[inputBase, { minHeight: 44, textAlignVertical: 'top' }]}
        multiline
      />
    </View>
  );
}

function EmptyFieldsPlaceholder({ colors, onStartAI }: { colors: ReturnType<typeof useColors>; onStartAI: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 }}>
      <View style={{
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: colors.indigoBg,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 14,
      }}>
        <Text style={{ fontSize: 22 }}>✦</Text>
      </View>
      <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.text, marginBottom: 6 }}>
        No profile details yet
      </Text>
      <Text style={{
        fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textMuted,
        textAlign: 'center', lineHeight: 19, marginBottom: 20,
      }}>
        Chat with Career Compass AI to build your profile automatically, or tap Edit to add details manually.
      </Text>
      <Pressable
        onPress={onStartAI}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 8,
          backgroundColor: colors.primary, borderRadius: 12,
          paddingHorizontal: 20, paddingVertical: 12,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: '#fff' }}>Build with AI</Text>
        <Feather name="arrow-right" size={14} color="#fff" />
      </Pressable>
    </View>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, updateProfile, applications, contacts } = useApp();

  const [isEditing, setIsEditing] = useState(false);
  const [editFields, setEditFields] = useState<ProfileField[]>([]);
  const [editName, setEditName] = useState('');
  const [editWeeklyGoal, setEditWeeklyGoal] = useState('5');
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 72 : insets.bottom + 56;

  const profileFields: ProfileField[] = profile?.profileFields ?? [];
  const hasFields = profileFields.length > 0;

  const derivedName = profile?.displayName && profile.displayName !== 'You'
    ? profile.displayName
    : getFieldValue(profileFields, 'full name', 'name') || '';

  const derivedDegree = getFieldValue(profileFields, 'current degree', 'degree', 'qualification')
    ?? (profile?.currentDegree || '');
  const derivedInstitution = getFieldValue(profileFields, 'institution', 'university', 'college')
    ?? (profile?.institution || '');
  const derivedYear = getFieldValue(profileFields, 'year of study', 'year')
    ?? (profile?.yearOfStudy || '');

  const completenessPercent = hasFields
    ? Math.min(100, Math.round((profileFields.length / 10) * 100))
    : Math.round(
        [
          !!profile?.displayName?.trim() && profile.displayName !== 'You',
          !!profile?.currentDegree?.trim(),
          !!profile?.institution?.trim(),
          !!profile?.yearOfStudy?.trim(),
          !!profile?.skills?.trim(),
          !!profile?.city?.trim(),
          !!profile?.preferredIndustries?.trim(),
          !!profile?.careerGoals?.trim(),
          !!profile?.portfolioUrl?.trim(),
        ].filter(Boolean).length / 9 * 100
      );

  const openEdit = () => {
    setEditFields(profileFields.map(f => ({ ...f })));
    setEditName(derivedName);
    setEditWeeklyGoal(String(profile?.weeklyGoal ?? 5));
    setNewLabel('');
    setIsEditing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setNewLabel('');
  };

  const handleFieldChange = (id: string, key: 'label' | 'value', text: string) => {
    setEditFields(prev => prev.map(f => f.id === id ? { ...f, [key]: text } : f));
  };

  const handleDeleteField = (id: string) => {
    Alert.alert('Remove field', 'Delete this profile field?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setEditFields(prev => prev.filter(f => f.id !== id)) },
    ]);
  };

  const handleAddField = () => {
    const label = newLabel.trim();
    if (!label) return;
    setEditFields(prev => [...prev, { id: genId(), label, value: '' }]);
    setNewLabel('');
    Haptics.selectionAsync();
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const numGoal = parseInt(editWeeklyGoal, 10);
    const cleaned = editFields.filter(f => f.label.trim() && f.value.trim());
    const nameField = editName.trim();

    const newName = nameField || getFieldValue(cleaned, 'full name', 'name') || profile.displayName;
    const newDegree = getFieldValue(cleaned, 'current degree', 'degree', 'qualification') || profile.currentDegree;
    const newInstitution = getFieldValue(cleaned, 'institution', 'university', 'college') || profile.institution;
    const newYear = getFieldValue(cleaned, 'year of study', 'year') || profile.yearOfStudy;
    const newSkills = getFieldValue(cleaned, 'technical skills', 'skills') || profile.skills;
    const newCity = getFieldValue(cleaned, 'city', 'location') || profile.city;
    const newIndustries = getFieldValue(cleaned, 'preferred industries', 'industries') || profile.preferredIndustries;
    const newGoals = getFieldValue(cleaned, 'career goals', 'goals') || profile.careerGoals;
    const newPortfolio = getFieldValue(cleaned, 'portfolio', 'github', 'linkedin') || profile.portfolioUrl;

    await updateProfile({
      ...profile,
      displayName: newName,
      currentDegree: newDegree,
      institution: newInstitution,
      yearOfStudy: newYear,
      skills: newSkills,
      city: newCity,
      preferredIndustries: newIndustries,
      careerGoals: newGoals,
      portfolioUrl: newPortfolio,
      weeklyGoal: isNaN(numGoal) || numGoal < 1 ? 5 : numGoal,
      profileFields: cleaned,
    });
    setSaving(false);
    setIsEditing(false);
  };

  const handleReset = () => {
    Alert.alert(
      'Reset all data',
      'This will permanently delete your profile, all applications, and contacts. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything', style: 'destructive',
          onPress: async () => {
            if (!profile) return;
            await updateProfile({
              ...profile,
              displayName: 'You',
              currentDegree: '', institution: '', yearOfStudy: '', skills: '',
              city: '', preferredIndustries: '', careerGoals: '', portfolioUrl: '',
              weeklyGoal: 5,
              profileFields: [],
            });
            setIsEditing(false);
          },
        },
      ],
    );
  };

  const s = styles(colors);

  return (
    <KeyboardAwareScrollView
      style={s.screen}
      contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: bottomPad + 24, paddingHorizontal: 16 }}
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Avatar ── */}
      <View style={s.avatarSection}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{(derivedName[0] || 'Y').toUpperCase()}</Text>
        </View>
        <Text style={s.avatarName}>{derivedName || 'Your Name'}</Text>
        {(!!derivedYear || !!derivedDegree) && (
          <Text style={s.avatarSub}>
            {[derivedYear, derivedDegree].filter(Boolean).join(' · ')}
          </Text>
        )}
        {!!derivedInstitution && (
          <Text style={s.avatarInstitution}>{derivedInstitution}</Text>
        )}
      </View>

      {/* ── Stats row ── */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statValue}>{applications.length}</Text>
          <Text style={s.statLabel}>Applications</Text>
        </View>
        <View style={[s.statCard, { borderColor: colors.blueBorder }]}>
          <Text style={[s.statValue, { color: colors.blue }]}>{contacts.length}</Text>
          <Text style={s.statLabel}>Contacts</Text>
        </View>
        <View style={[s.statCard, {
          borderColor: completenessPercent >= 80 ? colors.successBorder : colors.warningBorder,
          backgroundColor: completenessPercent >= 80 ? colors.successBg : colors.warningBg,
        }]}>
          <Text style={[s.statValue, { color: completenessPercent >= 80 ? colors.success : colors.warning }]}>
            {completenessPercent}%
          </Text>
          <Text style={s.statLabel}>Profile</Text>
        </View>
      </View>

      {/* ── Progress bar ── */}
      <View style={s.progressWrap}>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${completenessPercent}%` as any }]} />
        </View>
        <Text style={s.progressLabel}>
          {hasFields
            ? `${profileFields.length} profile field${profileFields.length !== 1 ? 's' : ''} · ${completenessPercent < 100 ? 'more detail = better AI results' : 'Fully set up ✓'}`
            : completenessPercent < 100 ? 'Add more info for better AI results' : 'Profile fully set up ✓'}
        </Text>
      </View>

      {/* ── AI banner ── */}
      <Pressable
        style={({ pressed }) => [s.aiBanner, pressed && { opacity: 0.82 }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/onboarding'); }}
        android_ripple={{ color: 'rgba(99,102,241,0.2)' }}
        accessibilityLabel="Update profile with AI"
      >
        <View style={s.aiBannerLeft}>
          <View style={s.aiIconWrap}>
            <Text style={{ fontSize: 14 }}>✦</Text>
          </View>
          <View>
            <Text style={s.aiBannerTitle}>{hasFields ? 'Update with AI' : 'Build with AI'}</Text>
            <Text style={s.aiBannerSub}>
              {hasFields ? 'Chat to update your profile' : 'Let AI collect your details in a conversation'}
            </Text>
          </View>
        </View>
        <Feather name="chevron-right" size={16} color={colors.primary} />
      </Pressable>

      {/* ── Profile details card (view mode) ── */}
      {!isEditing && (
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Profile Details</Text>
            <Pressable
              style={({ pressed }) => [s.editBtn, pressed && { opacity: 0.75 }]}
              onPress={openEdit}
              accessibilityLabel="Edit profile"
            >
              <Feather name="edit-2" size={13} color={colors.primary} />
              <Text style={s.editBtnText}>Edit</Text>
            </Pressable>
          </View>

          {hasFields ? (
            profileFields.map((field, i) => (
              <FieldViewRow key={field.id} field={field} isLast={i === profileFields.length - 1} colors={colors} />
            ))
          ) : (
            <EmptyFieldsPlaceholder colors={colors} onStartAI={() => router.push('/onboarding')} />
          )}
        </View>
      )}

      {/* ── Weekly goal (view mode) ── */}
      {!isEditing && (
        <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 14 }]}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.indigoBg, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="trending-up" size={15} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.text }}>Weekly Goal</Text>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textMuted, marginTop: 1 }}>
              {profile?.weeklyGoal ?? 5} applications per week
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [s.editBtn, pressed && { opacity: 0.75 }]}
            onPress={openEdit}
          >
            <Feather name="edit-2" size={13} color={colors.primary} />
            <Text style={s.editBtnText}>Edit</Text>
          </Pressable>
        </View>
      )}

      {/* ── Edit form ── */}
      {isEditing && (
        <View style={s.editForm}>
          <View style={s.editFormHeader}>
            <Text style={s.editFormTitle}>Edit Profile</Text>
            <Pressable onPress={cancelEdit} style={s.cancelBtn}>
              <Feather name="x" size={16} color={colors.textMuted} />
              <Text style={s.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>

          {/* Display name override */}
          <View style={{ marginBottom: 20 }}>
            <Text style={s.editGroupLabel}>Display Name</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Your full name"
              placeholderTextColor={colors.textMuted}
              style={{
                backgroundColor: colors.muted, borderRadius: 12, padding: 14,
                fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.text,
                borderWidth: 1, borderColor: colors.border,
              }}
            />
          </View>

          {/* Weekly goal */}
          <View style={{ marginBottom: 20 }}>
            <Text style={s.editGroupLabel}>Applications per week</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TextInput
                value={editWeeklyGoal}
                onChangeText={setEditWeeklyGoal}
                keyboardType="number-pad"
                maxLength={2}
                style={{
                  width: 70, textAlign: 'center',
                  backgroundColor: colors.muted, borderRadius: 12, padding: 14,
                  fontSize: 18, fontFamily: 'Inter_700Bold', color: colors.text,
                  borderWidth: 1, borderColor: colors.border,
                }}
                selectTextOnFocus
              />
              <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.textSecondary }}>
                applications / week
              </Text>
            </View>
          </View>

          {/* Dynamic profile fields */}
          <Text style={[s.editGroupLabel, { marginBottom: 10 }]}>Profile Fields</Text>
          <Text style={{
            fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textMuted,
            marginBottom: 14, lineHeight: 17,
          }}>
            Add, edit, or remove any field. Use clear labels like "Work Experience", "Python", "Zulu (Fluent)", etc.
          </Text>

          {editFields.length === 0 && (
            <View style={{
              paddingVertical: 20, alignItems: 'center',
              borderRadius: 12, borderWidth: 1, borderColor: colors.border,
              borderStyle: 'dashed', marginBottom: 14,
            }}>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textMuted }}>
                No fields yet — add one below
              </Text>
            </View>
          )}

          {editFields.map((field) => (
            <FieldEditRow
              key={field.id}
              field={field}
              onChange={handleFieldChange}
              onDelete={handleDeleteField}
              colors={colors}
            />
          ))}

          {/* Add new field */}
          <View style={{
            flexDirection: 'row', gap: 8, alignItems: 'center',
            marginBottom: 24, marginTop: 4,
          }}>
            <TextInput
              value={newLabel}
              onChangeText={setNewLabel}
              placeholder="New field label…"
              placeholderTextColor={colors.textMuted}
              style={{
                flex: 1,
                backgroundColor: colors.muted, borderRadius: 12,
                paddingHorizontal: 14, paddingVertical: 12,
                fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.text,
                borderWidth: 1, borderColor: colors.border,
              }}
              returnKeyType="done"
              onSubmitEditing={handleAddField}
            />
            <Pressable
              onPress={handleAddField}
              style={({ pressed }) => ({
                paddingHorizontal: 16, paddingVertical: 12,
                backgroundColor: newLabel.trim() ? colors.primary : colors.muted,
                borderRadius: 12, borderWidth: 1,
                borderColor: newLabel.trim() ? colors.primary : colors.border,
                opacity: pressed ? 0.85 : 1,
              })}
              disabled={!newLabel.trim()}
              accessibilityLabel="Add field"
            >
              <Feather name="plus" size={18} color={newLabel.trim() ? '#fff' : colors.textMuted} />
            </Pressable>
          </View>

          {/* Save */}
          <Pressable
            style={({ pressed }) => [s.saveBtn, pressed && { opacity: 0.85 }, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
            android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
            accessibilityLabel="Save profile"
          >
            <Feather name="check" size={18} color="#fff" />
            <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
          </Pressable>
        </View>
      )}

      {/* ── Danger zone ── */}
      <Pressable
        style={({ pressed }) => [s.resetBtn, pressed && { opacity: 0.85 }]}
        onPress={handleReset}
        android_ripple={{ color: colors.dangerBg }}
        accessibilityLabel="Reset all data"
      >
        <Feather name="trash-2" size={14} color={colors.danger} />
        <Text style={s.resetBtnText}>Reset All Data</Text>
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  avatarSection: { alignItems: 'center', marginBottom: 20 },
  avatar: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: colors.indigoBg,
    borderWidth: 2.5, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 34, fontFamily: 'Inter_700Bold', color: colors.primary },
  avatarName: { fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.text, letterSpacing: -0.4, marginBottom: 3 },
  avatarSub: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.textSecondary, marginBottom: 2 },
  avatarInstitution: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textMuted },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    backgroundColor: colors.indigoBg, borderRadius: 14,
    borderWidth: 1, borderColor: colors.indigoBorder,
  },
  statValue: { fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },

  progressWrap: { marginBottom: 16 },
  progressTrack: { height: 4, backgroundColor: colors.muted, borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: 4, backgroundColor: colors.success, borderRadius: 2 },
  progressLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.textMuted, textAlign: 'center' },

  aiBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.indigoBg,
    borderRadius: 16, borderWidth: 1, borderColor: colors.indigoBorder,
    paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 12,
  },
  aiBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  aiBannerTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary },
  aiBannerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textMuted, marginTop: 1, maxWidth: 200 },

  card: {
    backgroundColor: colors.card,
    borderRadius: 18, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: colors.text },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.indigoBg,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.indigoBorder,
  },
  editBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.primary },

  editForm: {
    backgroundColor: colors.card,
    borderRadius: 18, borderWidth: 1, borderColor: colors.border,
    padding: 16,
    marginBottom: 10,
  },
  editFormHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20,
  },
  editFormTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.text },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cancelBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.textMuted },
  editGroupLabel: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold',
    color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 8,
  },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 15,
  },
  saveBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },

  resetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 8, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1, borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerBg,
  },
  resetBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.danger },
});
