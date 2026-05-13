import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const FIRST_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: `Hi! I'm Career Compass AI. I'll ask you a few quick questions to set up your profile — it only takes 2 minutes, and the more I know about you, the better I can match you with WIL opportunities.\n\nLet's start — what's your full name?`,
};

function getApiBase() {
  const d = process.env.EXPO_PUBLIC_DOMAIN;
  return d ? `https://${d}` : '';
}

function useVoiceInput(onTranscript: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const supported = Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    !!(((window as any).SpeechRecognition) || ((window as any).webkitSpeechRecognition));

  const toggleListening = useCallback(() => {
    if (!supported) return;
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = 'en-ZA';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onTranscript(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [supported, isListening, onTranscript]);

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  return { isListening, toggleListening, supported };
}

function TypingDots({ colors }: { colors: ReturnType<typeof useColors> }) {
  const dots = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(dot, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 280, useNativeDriver: true }),
          Animated.delay(540 - i * 180),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 2 }}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.primary, opacity: dot }}
        />
      ))}
    </View>
  );
}

function MessageBubble({ msg, colors, index }: { msg: ChatMessage; colors: ReturnType<typeof useColors>; index: number }) {
  const isAI = msg.role === 'assistant';
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, delay: index === 0 ? 200 : 0, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 280, delay: index === 0 ? 200 : 0, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[
      { opacity, transform: [{ translateY }] },
      isAI ? { alignSelf: 'flex-start', maxWidth: '85%' } : { alignSelf: 'flex-end', maxWidth: '80%' },
      { marginBottom: 12 },
    ]}>
      {isAI && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 10, color: '#fff' }}>✦</Text>
          </View>
          <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.primary, letterSpacing: 0.5 }}>
            CAREER COMPASS AI
          </Text>
        </View>
      )}
      <View style={[
        isAI ? {
          backgroundColor: 'rgba(99,102,241,0.1)',
          borderColor: 'rgba(99,102,241,0.25)',
          borderWidth: 1,
          borderRadius: 18,
          borderTopLeftRadius: 4,
          paddingHorizontal: 16,
          paddingVertical: 13,
        } : {
          backgroundColor: 'rgba(255,255,255,0.09)',
          borderColor: 'rgba(255,255,255,0.13)',
          borderWidth: 1,
          borderRadius: 18,
          borderTopRightRadius: 4,
          paddingHorizontal: 16,
          paddingVertical: 13,
        }
      ]}>
        <Text style={{
          fontSize: 15,
          fontFamily: 'Inter_400Regular',
          color: colors.text,
          lineHeight: 22,
        }}>
          {msg.content}
        </Text>
      </View>
    </Animated.View>
  );
}

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, updateProfile } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>([FIRST_MESSAGE]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const { isListening, toggleListening, supported: voiceSupported } = useVoiceInput(
    useCallback((transcript: string) => {
      setInput(prev => prev ? `${prev} ${transcript}` : transcript);
    }, [])
  );

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isThinking]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isThinking || isDone) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const userMsg: ChatMessage = { role: 'user', content: text };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    const history = [...messages, userMsg].filter(m => m !== FIRST_MESSAGE);

    try {
      const res = await fetch(`${getApiBase()}/api/ai/profile-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok) throw new Error('api');
      const data = await res.json();

      const aiMsg: ChatMessage = { role: 'assistant', content: data.reply || "I'm having trouble — please try again." };
      setMessages(prev => [...prev, aiMsg]);

      if (data.isComplete && data.profileData && profile) {
        setIsDone(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const rawFields: Array<{ label: string; value: string }> = data.profileData.profileFields || [];
        const profileFields = rawFields
          .filter((f) => f.label?.trim() && f.value?.trim())
          .map((f, i) => ({ id: `ai_${Date.now()}_${i}`, label: f.label.trim(), value: f.value.trim() }));
        await updateProfile({
          ...profile,
          displayName: data.profileData.displayName || profile.displayName,
          currentDegree: data.profileData.currentDegree || profile.currentDegree,
          institution: data.profileData.institution || profile.institution,
          yearOfStudy: data.profileData.yearOfStudy || profile.yearOfStudy,
          skills: data.profileData.skills || profile.skills,
          city: data.profileData.city || profile.city,
          preferredIndustries: data.profileData.preferredIndustries || profile.preferredIndustries,
          careerGoals: data.profileData.careerGoals || profile.careerGoals,
          portfolioUrl: data.profileData.portfolioUrl || profile.portfolioUrl,
          profileFields: profileFields.length > 0 ? profileFields : profile.profileFields,
        });
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please check your internet and try again.",
      }]);
    } finally {
      setIsThinking(false);
      inputRef.current?.focus();
    }
  }, [input, isThinking, isDone, messages, profile, updateProfile]);

  const handleContinue = useCallback(() => {
    router.replace('/(tabs)');
  }, [router]);

  const handleSkip = useCallback(() => {
    router.replace('/(tabs)');
  }, [router]);

  const s = styles(colors);
  const topPad = Platform.OS === 'web' ? 20 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 20 : insets.bottom;

  return (
    <View style={[s.screen, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerCenter}>
          <View style={s.aiDot} />
          <Text style={s.headerTitle}>Career Compass AI</Text>
        </View>
        <Pressable onPress={handleSkip} style={s.skipBtn} accessibilityLabel="Skip setup">
          <Text style={s.skipText}>Skip</Text>
        </Pressable>
      </View>

      {/* Chat area */}
      <ScrollView
        ref={scrollRef}
        style={s.chatArea}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToBottom}
      >
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} colors={colors} index={i} />
        ))}

        {isThinking && (
          <Animated.View style={{ alignSelf: 'flex-start', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 10, color: '#fff' }}>✦</Text>
              </View>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.primary, letterSpacing: 0.5 }}>
                CAREER COMPASS AI
              </Text>
            </View>
            <View style={[s.thinkingBubble]}>
              <TypingDots colors={colors} />
            </View>
          </Animated.View>
        )}

        {isDone && (
          <View style={s.doneCard}>
            <View style={s.doneIconWrap}>
              <Feather name="check" size={22} color="#10b981" />
            </View>
            <Text style={s.doneTitle}>Profile saved!</Text>
            <Text style={s.doneSub}>You're all set. Let's find your next opportunity.</Text>
            <Pressable style={s.continueBtn} onPress={handleContinue} android_ripple={{ color: 'rgba(255,255,255,0.15)' }}>
              <Text style={s.continueBtnText}>Continue to Career Compass</Text>
              <Feather name="arrow-right" size={16} color="#fff" />
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Input area */}
      {!isDone && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={topPad}
        >
          <View style={[s.inputArea, { paddingBottom: bottomPad + 12 }]}>
            <View style={s.inputRow}>
              <TextInput
                ref={inputRef}
                value={input}
                onChangeText={setInput}
                placeholder="Type your answer…"
                placeholderTextColor={colors.textMuted}
                style={s.textInput}
                multiline
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={handleSend}
                blurOnSubmit={false}
                editable={!isThinking && !isDone}
                accessibilityLabel="Chat input"
              />
              {voiceSupported && (
                <Pressable
                  style={[s.micBtn, isListening && s.micBtnActive]}
                  onPress={toggleListening}
                  accessibilityLabel={isListening ? 'Stop listening' : 'Speak your answer'}
                >
                  <Feather name={isListening ? 'mic-off' : 'mic'} size={18} color={isListening ? '#fff' : colors.textMuted} />
                </Pressable>
              )}
              <Pressable
                style={[s.sendBtn, (!input.trim() || isThinking) && s.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!input.trim() || isThinking}
                accessibilityLabel="Send message"
                android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
              >
                <Feather name="send" size={18} color={!input.trim() || isThinking ? colors.textMuted : '#fff'} />
              </Pressable>
            </View>
            {voiceSupported && isListening && (
              <Text style={s.listeningHint}>Listening… speak now</Text>
            )}
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    position: 'relative',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
    letterSpacing: -0.3,
  },
  skipBtn: {
    position: 'absolute',
    right: 20,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.textMuted,
  },
  chatArea: {
    flex: 1,
  },
  thinkingBubble: {
    backgroundColor: 'rgba(99,102,241,0.1)',
    borderColor: 'rgba(99,102,241,0.25)',
    borderWidth: 1,
    borderRadius: 18,
    borderTopLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  doneCard: {
    alignItems: 'center',
    padding: 28,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
    marginTop: 8,
  },
  doneIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(16,185,129,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  doneTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: colors.success,
    marginBottom: 6,
  },
  doneSub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  continueBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  inputArea: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: colors.text,
    maxHeight: 120,
    lineHeight: 21,
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listeningHint: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 8,
  },
});
