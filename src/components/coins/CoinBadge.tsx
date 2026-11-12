// Small "🪙 123 · Gold" badge for the profile header. Never throws.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { tierFor, tierLabel } from '../../config/coins';
import { onCoinTotal } from '../../services/coinBus';
import { cachedCoinTotal, loadCoinTotal } from '../../services/coinsApi';
import Coin from './Coin';

export default function CoinBadge({ uid }: { uid?: string | null }) {
  const [total, setTotal] = useState<number | null>(() => cachedCoinTotal(uid));
  useEffect(() => {
    let alive = true;
    const off = onCoinTotal(t => {
      if (alive) setTotal(t);
    });
    loadCoinTotal(uid).then(t => {
      if (alive && t !== null) setTotal(t);
    });
    return () => {
      alive = false;
      off();
    };
  }, [uid]);
  if (total === null) return null;
  const tier = tierFor(total);
  return (
    <View style={styles.badge} accessibilityLabel={`${total} coins, ${tierLabel(tier)} tier`}>
      <Coin tier={tier} size={18} />
      <Text style={styles.text}>
        {total.toLocaleString()} · {tierLabel(tier)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 3,
    paddingLeft: 4,
    paddingRight: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(128,128,128,0.14)',
  },
  text: { marginLeft: 6, fontSize: 13, fontWeight: '700', color: '#8A6D1A' },
});
