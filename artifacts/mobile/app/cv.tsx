import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CVDocument, useApp } from '@/context/AppContext';
import { getApiBase } from '@/constants/config';
import { useColors } from '@/hooks/useColors';

type CVEditor = Omit<CVDocument, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
};

function makeDraft(profile: ReturnType<typeof useApp>['profile']): CVEditor {
  const name = profile?.displayName && profile.displayName !== 'You' ? profile.displayName : 'Your Name';
  const contact = [profile?.city, profile?.portfolioUrl].filter(Boolean).join('  •  ');
  return {
    title: profile?.preferredIndustries ? `${profile.preferredIndustries} CV` : 'My CV',
    targetIndustry: profile?.preferredIndustries ?? '',
    targetRole: profile?.currentDegree ?? '',
    content: [
      name,
      profile?.currentDegree || 'Professional headline',
      contact || 'City, Country  •  email@example.com  •  LinkedIn / portfolio',
      '',
      'PROFESSIONAL SUMMARY',
      profile?.careerGoals || 'A focused summary of your strengths, experience, and the value you can bring to an employer.',
      '',
      'EDUCATION',
      [profile?.currentDegree, profile?.institution, profile?.yearOfStudy].filter(Boolean).join(' — ') || 'Qualification — Institution',
      '',
      'SKILLS',
      profile?.skills || 'Add the skills most relevant to your target industry.',
      '',
      'EXPERIENCE',
      'Add your work, internship, volunteer, or project experience here.',
      '',
      'PROJECTS & ACHIEVEMENTS',
      'Add projects, awards, leadership, or other evidence of your strengths.',
      '',
      'REFERENCES',
      'Available on request',
    ].join('\n'),
  };
}

function previewLines(content: string) {
  return content.split(/\r?\n/).map((line, index) => {
    const trimmed = line.trim();
    const isHeading = /^(PROFESSIONAL SUMMARY|EDUCATION|EXPERIENCE|SKILLS|PROJECTS & ACHIEVEMENTS|CERTIFICATIONS|LANGUAGES|REFERENCES)$/i.test(trimmed);
    const isName = index === 0 && trimmed.length > 0;
    return (
      <Text key={`${index}-${line}`} style={isHeading ? styles.previewHeading : isName ? styles.previewName : styles.previewLine}>
        {line || ' '}
      </Text>
    );
  });
}

export default function CVStudioScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, cvDocuments, isLoaded, saveCVDocument, deleteCVDocument } = useApp();
  const [draft, setDraft] = useState<CVEditor | null>(null);
  const [sourceDraft, setSourceDraft] = useState('');
  const [busy, setBusy] = useState<'generate' | 'polish' | 'save' | ''>('');

  useEffect(() => {
    if (!isLoaded || draft) return;
    const first = cvDocuments[0];
    setDraft(first ? { ...first } : makeDraft(profile));
  }, [cvDocuments, draft, isLoaded, profile]);

  const bottomPadding = Platform.OS === 'web' ? 24 : insets.bottom + 24;
  const selectedId = draft?.id;
  const canUseAI = Boolean(profile?.currentDegree || profile?.careerGoals || draft?.content);
  const preview = useMemo(() => draft?.content ? previewLines(draft.content) : null, [draft?.content]);

  const updateDraft = (updates: Partial<CVEditor>) => {
    setDraft(current => current ? { ...current, ...updates } : current);
  };

  const selectDocument = (document: CVDocument) => {
    setDraft({ ...document });
    setSourceDraft('');
    Haptics.selectionAsync();
  };

  const startNew = () => {
    setDraft(makeDraft(profile));
    setSourceDraft('');
    Haptics.selectionAsync();
  };

  const runAI = async (mode: 'generate' | 'polish') => {
    if (!draft) return;
    if (mode === 'polish' && !draft.content.trim() && !sourceDraft.trim()) {
      Alert.alert('Add a CV first', 'Paste your current CV or add a few notes before asking Career Compass to polish it.');
      return;
    }
    const apiBase = getApiBase();
    if (!apiBase) {
      Alert.alert('AI is not connected', 'Set the app API URL before using CV generation. Your edits can still be saved locally.');
      return;
    }

    setBusy(mode);
    try {
      const response = await fetch(`${apiBase}/api/ai/cv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          targetIndustry: draft.targetIndustry,
          targetRole: draft.targetRole,
          draft: sourceDraft.trim() || draft.content,
          profile: {
            displayName: profile?.displayName,
            currentDegree: profile?.currentDegree,
            institution: profile?.institution,
            yearOfStudy: profile?.yearOfStudy,
            skills: profile?.skills,
            city: profile?.city,
            careerGoals: profile?.careerGoals,
            portfolioUrl: profile?.portfolioUrl,
            profileFields: profile?.profileFields,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok || typeof data.cv !== 'string' || !data.cv.trim()) throw new Error('cv');
      updateDraft({ content: data.cv, title: draft.title || `${draft.targetIndustry || 'Professional'} CV` });
      setSourceDraft('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Could not update your CV', 'Check your connection and try again. Your current draft is still safe on this screen.');
    } finally {
      setBusy('');
    }
  };

  const save = async () => {
    if (!draft || !draft.content.trim()) return;
    setBusy('save');
    const saved = await saveCVDocument({
      id: draft.id,
      title: draft.title.trim() || `${draft.targetIndustry || 'Professional'} CV`,
      targetIndustry: draft.targetIndustry.trim(),
      targetRole: draft.targetRole.trim(),
      content: draft.content.trim(),
    });
    setDraft({ ...saved });
    setBusy('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('CV saved', 'This version is available offline in CV Studio.');
  };

  const remove = () => {
    if (!draft?.id) return;
    Alert.alert('Delete this CV?', 'This saved version will be removed from your device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteCVDocument(draft.id!);
          startNew();
        },
      },
    ]);
  };

  const share = async () => {
    if (!draft?.content.trim()) return;
    await Share.share({ title: draft.title, message: draft.content });
  };

  if (!draft) {
    return <View style={[styles.loading, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  }

  const s = stylesWithColors(colors);
  return (
    <View style={[s.screen, { paddingTop: Platform.OS === 'web' ? 24 : insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.iconButton} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={21} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>CV Studio</Text>
          <Text style={s.headerSubtitle}>Build a CV for the job you want</Text>
        </View>
        <Pressable onPress={startNew} style={s.newButton} accessibilityLabel="Start a new CV">
          <Feather name="plus" size={16} color={colors.primary} />
          <Text style={s.newButtonText}>New</Text>
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        {cvDocuments.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.versions}>
            {cvDocuments.map(document => (
              <Pressable
                key={document.id}
                onPress={() => selectDocument(document)}
                style={[s.versionChip, document.id === selectedId && s.versionChipActive]}
              >
                <Feather name="file-text" size={13} color={document.id === selectedId ? colors.primary : colors.textMuted} />
                <Text numberOfLines={1} style={[s.versionText, document.id === selectedId && s.versionTextActive]}>
                  {document.title}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={s.hero}>
          <View style={s.heroIcon}><Feather name="file-text" size={22} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroTitle}>One profile, many strong CVs</Text>
            <Text style={s.heroCopy}>Generate a first draft, paste an existing CV, or tailor your wording to a specific industry without inventing experience.</Text>
          </View>
        </View>

        <Text style={s.sectionLabel}>Target role</Text>
        <TextInput
          value={draft.targetRole}
          onChangeText={targetRole => updateDraft({ targetRole })}
          placeholder="e.g. Graduate Software Developer"
          placeholderTextColor={colors.textMuted}
          style={s.input}
          accessibilityLabel="Target role"
        />
        <Text style={s.sectionLabel}>Target industry</Text>
        <TextInput
          value={draft.targetIndustry}
          onChangeText={targetIndustry => updateDraft({ targetIndustry })}
          placeholder="e.g. Fintech, engineering, healthcare"
          placeholderTextColor={colors.textMuted}
          style={s.input}
          accessibilityLabel="Target industry"
        />
        <Text style={s.sectionLabel}>CV name</Text>
        <TextInput
          value={draft.title}
          onChangeText={title => updateDraft({ title })}
          placeholder="e.g. Fintech graduate CV"
          placeholderTextColor={colors.textMuted}
          style={s.input}
          accessibilityLabel="CV name"
        />

        <Text style={s.sectionLabel}>AI actions</Text>
        <View style={s.aiRow}>
          <Pressable
            onPress={() => runAI('generate')}
            disabled={Boolean(busy) || !canUseAI}
            style={({ pressed }) => [s.aiButton, s.aiButtonPrimary, pressed && { opacity: 0.85 }, busy && { opacity: 0.65 }]}
          >
            {busy === 'generate' ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="zap" size={17} color="#fff" />}
            <View style={{ flex: 1 }}>
              <Text style={s.aiButtonTitle}>Generate from profile</Text>
              <Text style={s.aiButtonCopy}>Create a focused first draft</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => runAI('polish')}
            disabled={Boolean(busy)}
            style={({ pressed }) => [s.aiButton, s.aiButtonSecondary, pressed && { opacity: 0.85 }, busy && { opacity: 0.65 }]}
          >
            {busy === 'polish' ? <ActivityIndicator color={colors.primary} size="small" /> : <Feather name="edit-3" size={17} color={colors.primary} />}
            <View style={{ flex: 1 }}>
              <Text style={s.aiButtonTitleSecondary}>Polish & tailor</Text>
              <Text style={s.aiButtonCopy}>Improve this draft for the target</Text>
            </View>
          </Pressable>
        </View>

        <Text style={s.sectionLabel}>Existing CV or notes <Text style={s.optional}>(optional)</Text></Text>
        <TextInput
          value={sourceDraft}
          onChangeText={setSourceDraft}
          placeholder="Paste your current CV here, then tap Polish & tailor."
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
          style={[s.input, s.sourceInput]}
          accessibilityLabel="Existing CV or notes"
        />

        <View style={s.editorHeader}>
          <View>
            <Text style={s.sectionLabel}>Your CV</Text>
            <Text style={s.helper}>Keep claims truthful; add numbers wherever you can.</Text>
          </View>
          {draft.id && <Pressable onPress={remove} accessibilityLabel="Delete saved CV"><Feather name="trash-2" size={17} color={colors.danger} /></Pressable>}
        </View>
        <TextInput
          value={draft.content}
          onChangeText={content => updateDraft({ content })}
          multiline
          textAlignVertical="top"
          style={s.editor}
          accessibilityLabel="CV content editor"
        />

        <View style={s.previewHeader}>
          <View>
            <Text style={s.sectionLabel}>Preview</Text>
            <Text style={s.helper}>A clean text version you can share or copy into a document.</Text>
          </View>
          <Pressable onPress={share} style={s.shareButton} accessibilityLabel="Share CV">
            <Feather name="share-2" size={15} color={colors.primary} />
            <Text style={s.shareText}>Share</Text>
          </Pressable>
        </View>
        <View style={s.preview}>{preview}</View>

        <Pressable onPress={save} disabled={busy === 'save' || !draft.content.trim()} style={[s.saveButton, busy === 'save' && { opacity: 0.7 }]}>
          {busy === 'save' ? <ActivityIndicator color="#fff" /> : <Feather name="save" size={18} color="#fff" />}
          <Text style={s.saveText}>{busy === 'save' ? 'Saving…' : 'Save CV version'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  previewName: { fontSize: 22, lineHeight: 28, fontFamily: 'Inter_700Bold', color: '#f5f5ff', marginBottom: 2 },
  previewHeading: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_700Bold', color: '#818cf8', letterSpacing: 1, marginTop: 15, marginBottom: 3 },
  previewLine: { fontSize: 13, lineHeight: 20, fontFamily: 'Inter_400Regular', color: '#e5e7eb' },
});

function stylesWithColors(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    iconButton: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.muted },
    headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.text },
    headerSubtitle: { fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.textMuted, marginTop: 2 },
    newButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.indigoBg, borderWidth: 1, borderColor: colors.indigoBorder },
    newButtonText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.primary },
    versions: { gap: 8, paddingVertical: 14 },
    versionChip: { maxWidth: 180, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 11, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    versionChipActive: { backgroundColor: colors.indigoBg, borderColor: colors.indigoBorder },
    versionText: { maxWidth: 145, fontSize: 12, fontFamily: 'Inter_500Medium', color: colors.textMuted },
    versionTextActive: { color: colors.primary, fontFamily: 'Inter_700Bold' },
    hero: { flexDirection: 'row', gap: 12, padding: 16, marginBottom: 18, borderRadius: 18, backgroundColor: colors.indigoBg, borderWidth: 1, borderColor: colors.indigoBorder },
    heroIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
    heroTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: colors.text, marginBottom: 4 },
    heroCopy: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', color: colors.textSecondary },
    sectionLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.text, marginBottom: 7, marginTop: 4 },
    optional: { fontFamily: 'Inter_400Regular', color: colors.textMuted },
    input: { minHeight: 45, paddingHorizontal: 13, paddingVertical: 11, marginBottom: 12, borderRadius: 11, backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, color: colors.text, fontFamily: 'Inter_400Regular', fontSize: 14 },
    sourceInput: { minHeight: 92 },
    aiRow: { flexDirection: 'row', gap: 9, marginBottom: 13 },
    aiButton: { flex: 1, minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11, borderRadius: 14, borderWidth: 1 },
    aiButtonPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
    aiButtonSecondary: { backgroundColor: colors.indigoBg, borderColor: colors.indigoBorder },
    aiButtonTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#fff', marginBottom: 3 },
    aiButtonTitleSecondary: { fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.primary, marginBottom: 3 },
    aiButtonCopy: { fontSize: 10, lineHeight: 14, fontFamily: 'Inter_400Regular', color: colors.textSecondary },
    editorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 },
    helper: { fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.textMuted, marginBottom: 8 },
    editor: { minHeight: 370, padding: 14, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, color: colors.text, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, textAlignVertical: 'top' },
    previewHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 18 },
    shareButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 7, borderRadius: 9, backgroundColor: colors.indigoBg },
    shareText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.primary },
    preview: { padding: 18, borderRadius: 14, backgroundColor: '#15152e', borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
    saveButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, backgroundColor: colors.primary, marginTop: 2 },
    saveText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
  });
}