import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

export default function AuthScreen() {
  const colors = useColors();
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!email.trim() || password.length < 8) {
      setError('Enter a valid email and a password with at least 8 characters.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = isSignUp
        ? await signUp(email, password)
        : await signIn(email, password);
      if (!response.session) {
        Alert.alert(
          'Check your email',
          'Your account was created. Confirm your email, then sign in to enable cloud sync.',
        );
        setIsSignUp(false);
        return;
      }
      router.replace('/(tabs)');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to connect to the account service.');
    } finally {
      setBusy(false);
    }
  };

  const s = styles(colors);
  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={s.back} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={20} color={colors.textMuted} />
          <Text style={s.backText}>Back</Text>
        </Pressable>
        <View style={s.brandMark}>
          <Feather name="compass" size={28} color="#fff" />
        </View>
        <Text style={s.title}>{isSignUp ? 'Create your account' : 'Sign in to sync'}</Text>
        <Text style={s.subtitle}>
          {isSignUp
            ? 'Keep your Career Compass data available across devices.'
            : 'Your cached data stays available offline while cloud sync is restored.'}
        </Text>

        <View style={s.form}>
          <Text style={s.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            style={s.input}
            accessibilityLabel="Email address"
          />
          <Text style={s.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="At least 8 characters"
            placeholderTextColor={colors.textMuted}
            style={s.input}
            accessibilityLabel="Password"
          />
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Pressable
            onPress={submit}
            disabled={busy}
            style={[s.submit, busy && s.disabled]}
            accessibilityRole="button"
          >
            <Text style={s.submitText}>{busy ? 'Connecting…' : isSignUp ? 'Create account' : 'Sign in'}</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => { setIsSignUp(value => !value); setError(''); }} style={s.switchButton}>
          <Text style={s.switchText}>
            {isSignUp ? 'Already have an account? Sign in' : 'New to Career Compass? Create an account'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 36 },
  backText: { color: colors.textMuted, fontFamily: 'Inter_500Medium', fontSize: 14 },
  brandMark: {
    width: 56, height: 56, borderRadius: 18, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: { color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 28, letterSpacing: -0.6 },
  subtitle: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22, marginTop: 10 },
  form: { marginTop: 30 },
  label: { color: colors.textMuted, fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: {
    color: colors.text, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontFamily: 'Inter_400Regular',
    fontSize: 15, marginBottom: 18,
  },
  error: { color: colors.danger, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, marginBottom: 14 },
  submit: { backgroundColor: colors.primary, borderRadius: 14, alignItems: 'center', paddingVertical: 15, marginTop: 4 },
  disabled: { opacity: 0.55 },
  submitText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 15 },
  switchButton: { alignItems: 'center', marginTop: 24, padding: 8 },
  switchText: { color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});