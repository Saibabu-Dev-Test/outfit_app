// Settings > 📋 Terms & About: what Outfit is, what's in it, how to use it, coins and rewards,
// and the simple rules everyone agrees to. Plain, friendly words; numbers come from the configs.
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { borderRadius, colors, fontSize, fontWeight, spacing, themedStyles } from '../../theme';
import { COIN_POINTS, COIN_TIERS } from '../../config/coins';
import { LIKE_LEVELS } from '../../config/likeLevels';
import { REWARDS, TASK_COINS } from '../../config/monthlyTasks';

export const TERMS_UPDATED = '12 Nov 2026';

const tiers = [...COIN_TIERS].reverse().map(t => `${t.label} from ${t.min.toLocaleString()} coins`).join(' · ');
const levels = [...LIKE_LEVELS].reverse().map(l => `${l.label} from ${l.min.toLocaleString()} likes`).join(' · ');

const SECTIONS: { title: string; lines: string[] }[] = [
  {
    title: '👋 Welcome to Outfit',
    lines: [
      'Outfit is your friendly wardrobe and style app. Save your clothes, ask friends what to wear, get daily astrology colours, plan functions and festivals, and earn coins while you have fun.',
      'We built it to be kind, simple and useful for everyone. Thank you for being here!',
    ],
  },
  {
    title: '✨ What you can do',
    lines: [
      '👗 Wardrobe: add clothes, shoes and accessories (rings, earrings, nose rings, bangles and more) with a photo. Quick add saves up to 10 photos at once.',
      '🖼️ Photo options: keep the original photo, blur the background (choose how much), or remove the background (plain white or black).',
      '🗳️ Polls and votes: post 2-6 photos and let friends vote. Polls close 24 hours after posting.',
      '📰 Feed: like, comment and share looks from people you follow and the community.',
      '👥 Circles: chat with friends and family groups, share photos and polls.',
      '🔮 Astro: your daily reading, lucky colours and what to wear, then upcoming festivals with how to celebrate.',
      '🤖 Style: an AI stylist that suggests outfits from your own wardrobe for the place and occasion.',
      '📅 Function planner: reminders and weather for weddings and events you are going to.',
      '🔔 Notifications: likes, comments, votes and reminders (you can turn them off any time).',
    ],
  },
  {
    title: '🚀 Getting started',
    lines: [
      '1. Register with your name, gender, date of birth and mobile number. Everyone must be registered before they can upload, vote, like or comment, so the community stays real and safe.',
      '2. Add a few clothes to your wardrobe.',
      '3. Invite friends with your link and ask them to vote what you should wear.',
      '4. Open Astro each day for your colours and reading.',
    ],
  },
  {
    title: '🪙 Coins and how to earn them',
    lines: [
      `Like a photo: ${COIN_POINTS.like} coin · Upload a look: ${COIN_POINTS.upload} coins · Share the app: ${COIN_POINTS.share} coins · Finish a monthly task: ${TASK_COINS} coins.`,
      `Coin tiers: ${tiers}.`,
      `Like levels (likes your photos receive): ${levels}.`,
      'Your lifetime coins and tier never go down. Spending coins on a reward only uses your balance.',
    ],
  },
  {
    title: '🎁 Rewards and future benefits',
    lines: [
      ...REWARDS.map(r => `${r.emoji} ${r.title}: ${r.cost.toLocaleString()} coins. ${r.description}.`),
      'Rewards are checked and approved by the Outfit team. If a claim is rejected, the coins come back to you.',
      'We plan to add more benefits for active members in future updates: more rewards, shopping offers and special badges. Coins are a fun loyalty point inside the app, not money, and cannot be sold or exchanged for cash.',
    ],
  },
  {
    title: '🤝 Be friendly: community rules',
    lines: [
      'Be kind and respectful. No bullying, hate, threats or rude comments.',
      'Post only your own photos or photos you have permission to share. No nudity, violence or illegal content.',
      'No fake accounts, spam or tricks to earn coins. Accounts that cheat can lose coins and rewards, or be removed.',
      'Report anything that feels wrong. Our admins review reports and can remove posts, photos, comments or accounts.',
    ],
  },
  {
    title: '🔒 Your privacy',
    lines: [
      'Your photos and profile are stored securely in our cloud database. Background blur and removal happen on your own phone.',
      'Wardrobe items can be public or private. Private items are seen only by you.',
      'We show ads to keep Outfit free. Ads are provided by Google AdMob.',
      'You can delete your photos any time. To delete your account, contact us through Feedback & Suggestions.',
    ],
  },
  {
    title: '📋 The simple terms',
    lines: [
      'By registering and using Outfit you agree to these terms and the community rules.',
      'Astrology readings, AI style tips and weather are for fun and guidance only.',
      'Features, coins and rewards may change as the app grows. We will tell you about important changes in the app.',
      'Questions or ideas? Tell us in Settings > Feedback & Suggestions. We read every message.',
    ],
  },
];

export default function TermsScreen({ navigation }: { navigation: any }) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>📋 Terms & About</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {SECTIONS.map(s => (
          <View key={s.title} style={styles.card}>
            <Text style={styles.cardTitle}>{s.title}</Text>
            {s.lines.map((l, i) => (
              <Text key={i} style={styles.line}>
                {l}
              </Text>
            ))}
          </View>
        ))}
        <Text style={styles.meta}>Last updated {TERMS_UPDATED}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.base, paddingVertical: spacing.md },
    back: { fontSize: 32, color: colors.textPrimary, marginRight: spacing.md, lineHeight: 34 },
    title: { fontSize: fontSize.xl, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
    body: { padding: spacing.base, paddingBottom: spacing.xl },
    card: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: 6 },
    line: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 21, marginBottom: 6 },
    meta: { fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  }),
);
