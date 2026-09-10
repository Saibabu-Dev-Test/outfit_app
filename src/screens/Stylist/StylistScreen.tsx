import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';

const occasions = ['Work', 'College', 'Date', 'Party'];

type Message = {
  id: string;
  text: string;
  isUser: boolean;
  outfit?: {
    title: string;
    description: string;
    emoji: string;
    reason: string;
  };
};

const initialMessages: Message[] = [
  {
    id: '1',
    text: "What should I wear for a casual Friday at the office? I want to look professional but relaxed.",
    isUser: true,
  },
  {
    id: '2',
    text: "I'd go for a clean, slightly elevated look. A nice knit polo or button-down paired with tailored chinos and clean sneakers strikes the perfect balance.",
    isUser: false,
    outfit: {
      title: 'The Modern Professional',
      description: 'Knit polo + Tailored chinos + Clean sneakers',
      emoji: '👔',
      reason: 'The black knit shirt offers a refined texture over a standard tee, while beige trousers keep the look grounded and approachable. The crisp sneakers maintain a youthful edge without sacrificing professionalism.',
    },
  },
];

export default function StylistScreen() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputText, setInputText] = useState('');
  const [activeOccasion, setActiveOccasion] = useState('Work');

  const sendMessage = () => {
    if (!inputText.trim()) return;
    const newMsg: Message = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
    };
    setMessages(prev => [...prev, newMsg]);
    setInputText('');

    // Simulated AI response
    setTimeout(() => {
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        text: `Great choice for ${activeOccasion}! Here's what I'd suggest based on your style profile.`,
        isUser: false,
        outfit: {
          title: 'AI Curated Look',
          description: 'Smart casual combo tailored to your request',
          emoji: '✨',
          reason: 'This combination balances style and comfort, making it perfect for the occasion you described.',
        },
      };
      setMessages(prev => [...prev, reply]);
    }, 1200);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar
        barStyle="dark-content"
        {...(Platform.OS === 'android' ? { backgroundColor: colors.background } : {})}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSub}>✦ AI Powered</Text>
            <Text style={styles.headerTitle}>AI Stylist</Text>
          </View>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>✦</Text>
          </View>
        </View>

        {/* Occasion Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.occasionScroll}
          contentContainerStyle={styles.occasionContent}>
          {occasions.map(occ => (
            <TouchableOpacity
              key={occ}
              style={[styles.occasionChip, activeOccasion === occ && styles.occasionChipActive]}
              onPress={() => setActiveOccasion(occ)}>
              <Text style={[styles.occasionText, activeOccasion === occ && styles.occasionTextActive]}>
                {occ}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Messages */}
        <ScrollView
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}>
          {messages.map(msg => (
            <View key={msg.id}>
              {msg.isUser ? (
                <View style={styles.userBubble}>
                  <Text style={styles.userText}>{msg.text}</Text>
                </View>
              ) : (
                <View style={styles.aiBubbleContainer}>
                  <View style={styles.aiAvatar}>
                    <Text style={styles.aiAvatarText}>✦</Text>
                  </View>
                  <View style={styles.aiContent}>
                    <View style={styles.aiBubble}>
                      <Text style={styles.aiText}>{msg.text}</Text>
                    </View>
                    {msg.outfit && (
                      <View style={styles.outfitCard}>
                        <View style={styles.outfitImageBg}>
                          <Text style={styles.outfitEmoji}>{msg.outfit.emoji}</Text>
                        </View>
                        <View style={styles.outfitDetails}>
                          <Text style={styles.outfitTitle}>{msg.outfit.title}</Text>
                          <View style={styles.reasonBox}>
                            <Text style={styles.reasonLabel}>WHY IT WORKS</Text>
                            <Text style={styles.reasonText}>{msg.outfit.reason}</Text>
                          </View>
                          <TouchableOpacity style={styles.saveButton}>
                            <Text style={styles.saveButtonText}>Save Outfit</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Ask AI Stylist..."
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={300}
          />
          <TouchableOpacity style={styles.imageBtn}>
            <Text style={styles.imageBtnText}>🖼</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sendBtn, inputText.trim() && styles.sendBtnActive]}
            onPress={sendMessage}>
            <Text style={styles.sendBtnText}>▶</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerSub: {
    fontSize: fontSize.xs,
    color: colors.accent,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extraBold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: { color: colors.textInverse, fontSize: fontSize.base },
  occasionScroll: { maxHeight: 44, marginBottom: spacing.sm },
  occasionContent: {
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
    alignItems: 'center',
  },
  occasionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  occasionChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  occasionText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semiBold,
    color: colors.textSecondary,
  },
  occasionTextActive: { color: colors.textInverse },
  messages: { flex: 1 },
  messagesContent: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
    gap: spacing.md,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderBottomRightRadius: 4,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    maxWidth: '80%',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  userText: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  aiBubbleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  aiAvatarText: { color: colors.textInverse, fontSize: 14 },
  aiContent: { flex: 1, gap: spacing.sm },
  aiBubble: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderBottomLeftRadius: 4,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  aiText: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  outfitCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  outfitImageBg: {
    height: 140,
    backgroundColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outfitEmoji: { fontSize: 64 },
  outfitDetails: { padding: spacing.base },
  outfitTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  reasonBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  reasonLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  reasonText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveButtonText: {
    color: colors.textInverse,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.base,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    maxHeight: 100,
    paddingVertical: spacing.sm,
  },
  imageBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageBtnText: { fontSize: 20 },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnActive: { backgroundColor: colors.primary },
  sendBtnText: { color: colors.textInverse, fontSize: 14 },
});
