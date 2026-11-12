// "❤️ 2,345 likes · Silver" with the like-level coin (config/likeLevels.ts). Never throws.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { likeLevelFor, likeLevelLabel, likesToNextLevel } from '../../config/likeLevels';
import { loadLikesReceived } from '../../services/coinsApi';
import Coin from './Coin';

export default function LikeLevelBadge({ uid, showNext }: { uid?: string | null; showNext?: boolean }) {
  const [likes, setLikes] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    if (uid) loadLikesReceived(uid).then(n => alive && setLikes(n));
    return () => {
      alive = false;
    };
  }, [uid]);
  if (likes === null) return null;
  const level = likeLevelFor(likes);
  const next = showNext ? likesToNextLevel(likes) : null;
  return (
    <View style={styles.badge} accessibilityLabel={`${likes} likes received, ${likeLevelLabel(level)} level`}>
      <Coin tier={level} size={18} />
      <Text style={styles.text}>
        ❤️ {likes.toLocaleString()} {likes === 1 ? 'like' : 'likes'} · {likeLevelLabel(level)}
        {next !== null ? ` · ${next.toLocaleString()} to next` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 3,
    paddingLeft: 4,
    paddingRight: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(128,128,128,0.14)',
  },
  text: { marginLeft: 6, fontSize: 13, fontWeight: '700', color: '#B4475B' },
});
