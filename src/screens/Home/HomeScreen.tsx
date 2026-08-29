import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';

const lindaAvatar = require('../../assets/linda_avatar.jpg');
const outfitA = require('../../assets/outfit_a.jpg');

interface DailyColorResponse {
  date: string;
  day: string;
  recommended_color: string;
  secondary_colors: string[];
  confidence: number;
  reason: string;
  dress_suggestion: string;
}

const COLOR_HEX_MAP: Record<string, string> = {
  'DEEP BLUE': '#0D47A1',
  'NAVY BLUE': '#1A237E',
  'ROYAL BLUE': '#1565C0',
  'SKY BLUE': '#0288D1',
  'LIGHT BLUE': '#4FC3F7',
  'BLUE': '#1D92F3',
  'EMERALD GREEN': '#00897B',
  'OLIVE GREEN': '#558B2F',
  'SAGE GREEN': '#A8B5A0',
  'MINT GREEN': '#80CBC4',
  'GREEN': '#3FA73F',
  'MUSTARD YELLOW': '#F57F17',
  'PASTEL YELLOW': '#FFF59D',
  'YELLOW': '#FBC02D',
  'PURPLE': '#8E24AA',
  'VIOLET': '#7B1FA2',
  'LAVENDER': '#CE93D8',
  'ROSE PINK': '#F06292',
  'PINK': '#E91E63',
  'ORANGE': '#F57C00',
  'CORAL': '#FF7043',
  'CRIMSON': '#C62828',
  'MAROON': '#880E4F',
  'RED': '#D32F2F',
  'CHARCOAL': '#37474F',
  'BLACK': '#212121',
  'WHITE': '#EEEEEE',
  'SILVER': '#B0BEC5',
  'GOLD': '#FFD54F',
  'BEIGE': '#D7CCC8',
  'CREAM': '#FFF9C4',
};

const getColorHex = (colorName: string): string => {
  if (!colorName) return '#0D47A1';
  const upper = colorName.toUpperCase().trim();
  for (const [key, hex] of Object.entries(COLOR_HEX_MAP)) {
    if (upper.includes(key)) return hex;
  }
  return '#0D47A1';
};

const TOP_COLOURS = [
  { rank: 1, name: 'Blue', hex: '#1D92F3', votes: '22,545 votes', men: '45%', women: '55%', percentage: '22.8%' },
  { rank: 2, name: 'Green', hex: '#3FA73F', votes: '18,263 votes', men: '42%', women: '58%', percentage: '18.5%' },
  { rank: 3, name: 'Purple', hex: '#8E24AA', votes: '15,274 votes', men: '38%', women: '62%', percentage: '15.5%' },
  { rank: 4, name: 'Pink', hex: '#E91E63', votes: '12,840 votes', men: '30%', women: '70%', percentage: '13.0%' },
  { rank: 5, name: 'Yellow', hex: '#FBC02D', votes: '9,450 votes', men: '50%', women: '50%', percentage: '9.6%' },
  { rank: 6, name: 'Orange', hex: '#F57C00', votes: '7,120 votes', men: '48%', women: '52%', percentage: '7.2%' },
  { rank: 7, name: 'Red', hex: '#D32F2F', votes: '5,300 votes', men: '52%', women: '48%', percentage: '5.4%' },
  { rank: 8, name: 'Black', hex: '#212121', votes: '4,100 votes', men: '60%', women: '40%', percentage: '4.1%' },
];

export default function HomeScreen() {
  const [dailyStyle, setDailyStyle] = useState<DailyColorResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const fetchDailyColor = async () => {
      setLoading(true);
      const urls = Platform.OS === 'android'
        ? ['http://10.0.2.2:8000', 'http://localhost:8000', 'http://127.0.0.1:8000']
        : ['http://localhost:8000', 'http://127.0.0.1:8000', 'http://10.0.2.2:8000'];

      for (const baseUrl of urls) {
        try {
          const response = await fetch(`${baseUrl}/api/recommendations/color-response-daily`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              dateofbirth: '1995-05-15',
              name: 'Linda',
              gender: 'Female',
              rasi: 'Taurus',
              user_id: 'user_123',
            }),
          });

          if (response.ok) {
            const data: DailyColorResponse = await response.json();
            if (isMounted) {
              setDailyStyle(data);
              setLoading(false);
            }
            return;
          }
        } catch (err) {
          // try next URL candidate
        }
      }

      if (isMounted) {
        setLoading(false);
      }
    };

    fetchDailyColor();
    return () => { isMounted = false; };
  }, []);

  const recommendedColorName = dailyStyle?.recommended_color || 'DEEP BLUE';
  const colorHex = getColorHex(recommendedColorName);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar
        barStyle="dark-content"
        {...(Platform.OS === 'android' ? { backgroundColor: '#FAF9FC' } : {})}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image source={lindaAvatar} style={styles.avatar} />
            <Text style={styles.greeting}>Good morning, Linda</Text>
          </View>
          <TouchableOpacity style={styles.notifBadge} activeOpacity={0.7}>
            <Text style={styles.notifIcon}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* Today's Top Colours */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Today's Top Colours</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE RESULTS</Text>
          </View>
        </View>

        <View style={styles.topColoursCard}>
          <ScrollView
            style={styles.topColoursScroll}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={true}>
            {TOP_COLOURS.map((item, index) => (
              <React.Fragment key={item.rank}>
                <View style={styles.colorRow}>
                  <Text style={styles.colorRank}>{item.rank}</Text>
                  <View style={[styles.colorCircle, { backgroundColor: item.hex }]} />
                  <View style={styles.colorDetails}>
                    <Text style={styles.colorName}>{item.name}</Text>
                    <Text style={styles.votesCountText}>{item.votes}</Text>
                    <View style={styles.genderRow}>
                      <Text style={styles.genderText}>🧍‍♂️ Men: {item.men}</Text>
                      <View style={styles.genderDivider} />
                      <Text style={styles.genderText}>🧍‍♀️ Women: {item.women}</Text>
                    </View>
                  </View>
                  <Text style={styles.colorPercentage}>{item.percentage}</Text>
                </View>
                {index < TOP_COLOURS.length - 1 && <View style={styles.rowDivider} />}
              </React.Fragment>
            ))}
          </ScrollView>
        </View>

        {/* Your style for today */}
        <View style={styles.plainHeaderRow}>
          <Text style={styles.sectionTitle}>Your style for today</Text>
        </View>

        <View style={styles.styleCard}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#E91E63" />
              <Text style={styles.loadingText}>Fetching today's style...</Text>
            </View>
          ) : (
            <>
              <View style={[styles.sageGreenBlock, { backgroundColor: colorHex }]}>
                <Text style={styles.sageGreenTitle}>{recommendedColorName.toUpperCase()}</Text>
                <Text style={styles.sageGreenHex}>{colorHex}</Text>
              </View>
              <View style={styles.styleDescriptionBox}>
                <Text style={styles.styleDescriptionText}>
                  {dailyStyle?.dress_suggestion ||
                    'Embrace the calmness of nature. Sage green brings a grounding energy, perfect for a busy day of meetings followed by a relaxed evening.'}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Why this colour? */}
        <View style={styles.plainHeaderRow}>
          <Text style={styles.sectionTitle}>✨ Why this colour?</Text>
        </View>

        <View style={styles.whyColorCard}>
          <View style={styles.whyColorIconBox}>
            <Text style={styles.whyColorIcon}>🗓️</Text>
          </View>
          <View style={styles.whyColorContent}>
            <Text style={styles.whyColorTextMain}>
              {dailyStyle?.reason ||
                'Based on your calendar today, which includes an outdoor lunch and a creative review, Sage Green balances professionalism with a creative, approachable vibe.'}
            </Text>
            {dailyStyle?.secondary_colors && dailyStyle.secondary_colors.length > 0 && (
              <Text style={styles.whyColorTextSub}>
                Complementary shades: {dailyStyle.secondary_colors.join(', ')}
              </Text>
            )}
          </View>
        </View>

        {/* What do you think? */}
        <View style={styles.plainHeaderRow}>
          <Text style={styles.sectionTitle}>What do you think?</Text>
        </View>

        <View style={styles.outfitCard}>
          <Image source={outfitA} style={styles.outfitImage} />
          <View style={styles.outfitBadge}>
            <Text style={styles.outfitBadgeText}>OUTFIT A</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF9FC',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F2F8',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: spacing.md,
  },
  greeting: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0A1940',
  },
  notifBadge: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifIcon: {
    fontSize: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  plainHeaderRow: {
    paddingHorizontal: spacing.base,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A1940',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E91E63',
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E91E63',
    marginRight: 6,
  },
  liveText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#E91E63',
    letterSpacing: 0.5,
  },
  topColoursCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: spacing.base,
    borderWidth: 1,
    borderColor: '#EBE9F3',
    shadowColor: 'rgba(10, 25, 64, 0.04)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  topColoursScroll: {
    height: 254,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.base,
  },
  colorRank: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0A1940',
    width: 24,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Georgia-Bold' : 'serif',
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: 12,
    marginRight: 12,
  },
  colorDetails: {
    flex: 1,
  },
  colorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A1940',
    marginBottom: 2,
  },
  votesCountText: {
    fontSize: 12,
    color: '#6B6B8A',
    fontWeight: '400',
    marginBottom: 4,
  },
  genderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  genderText: {
    fontSize: 11,
    color: '#4A4A6A',
    fontWeight: '500',
  },
  genderDivider: {
    width: 1,
    height: 8,
    backgroundColor: '#E8E6F0',
    marginHorizontal: spacing.sm,
  },
  colorPercentage: {
    fontSize: 16,
    fontWeight: '800',
    color: '#E91E63',
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#FAF9FC',
    marginHorizontal: spacing.base,
  },
  styleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: spacing.base,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EBE9F3',
    shadowColor: 'rgba(10, 25, 64, 0.04)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2,
  },
  sageGreenBlock: {
    height: 140,
    backgroundColor: '#A8B5A0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sageGreenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  sageGreenHex: {
    fontSize: 11,
    color: '#FFFFFF',
    opacity: 0.8,
    marginTop: 6,
    letterSpacing: 2,
    fontWeight: '600',
  },
  styleDescriptionBox: {
    padding: spacing.base,
  },
  styleDescriptionText: {
    fontSize: 14,
    color: '#4A4A6A',
    lineHeight: 22,
    fontWeight: '400',
  },
  whyColorCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: spacing.base,
    padding: spacing.base,
    borderWidth: 1.5,
    borderColor: '#D8CFFC',
    shadowColor: 'rgba(10, 25, 64, 0.03)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2,
  },
  whyColorIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4A148C',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  whyColorIcon: {
    fontSize: 18,
  },
  whyColorContent: {
    flex: 1,
    marginLeft: 12,
  },
  whyColorTextMain: {
    fontSize: 13,
    color: '#0A1940',
    lineHeight: 19,
    fontWeight: '500',
    marginBottom: 6,
  },
  whyColorTextSub: {
    fontSize: 12,
    color: '#6B6B8A',
    lineHeight: 18,
    fontWeight: '400',
  },
  outfitCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: spacing.base,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EBE9F3',
    position: 'relative',
    shadowColor: 'rgba(10, 25, 64, 0.04)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2,
  },
  outfitImage: {
    width: '100%',
    height: 360,
    resizeMode: 'cover',
  },
  outfitBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  outfitBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0A1940',
    letterSpacing: 1,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: 13,
    color: '#6B6B8A',
  },
});

