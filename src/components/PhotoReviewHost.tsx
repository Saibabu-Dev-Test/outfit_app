// Photo options for every photo upload (quick add, posts / polls, circle + birthday chat, avatar,
// feedback): after picking, the photos open here with "Blur face" (on-device face detection,
// native/photoEdit.ts) and "Adjust" (zoom + position, PhotoAdjustModal) — plus Original / Blur /
// Remove BG for wardrobe photos — then "Use photo". Everything is made again from the ORIGINAL
// picked file (utils/imagePicker remakeImage), so options can be switched freely.
// Mounted once in App.tsx; screens call reviewPhotos() / reviewPhoto() after picking. When the
// host or the native module is missing (old APK, web) the photos pass through unchanged.
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PickOptions, PickedImage, PHOTO_PICK, remakeImage } from '../utils/imagePicker';
import { isPhotoBgSupported, PHOTO_BG_MODES, PhotoBgMode } from '../native/photoBackground';
import { isPhotoEditSupported } from '../native/photoEdit';
import { isFullCrop } from '../utils/cropMath';
import { useAppLanguage } from '../i18n/appLanguage';
import { faceMessage, photoText } from '../i18n/photoEditLabels';
import PhotoAdjustModal, { AdjustState } from './PhotoAdjustModal';

export interface ReviewOptions {
  bg?: boolean; // also offer Original / Blur / Remove BG (wardrobe photos)
}

interface Request {
  images: PickedImage[];
  opts: PickOptions;
  review: ReviewOptions;
  resolve: (images: PickedImage[]) => void;
}

let show: ((r: Request) => void) | null = null;

/** Photos after the user's photo options ([] when they closed it). Unchanged when unavailable. */
export const reviewPhotos = (
  images: PickedImage[],
  opts: PickOptions = PHOTO_PICK,
  review: ReviewOptions = {},
): Promise<PickedImage[]> => {
  if (!images.length || !show || !isPhotoEditSupported() || !images.some(i => !!i.uri)) return Promise.resolve(images);
  // Same sizes pickImages used for this many photos
  const o = images.length > 1 && opts.ifSeveral ? opts.ifSeveral : opts;
  return new Promise(resolve => {
    try {
      show!({ images, opts: o, review, resolve });
    } catch {
      resolve(images);
    }
  });
};

/** One photo (pickImage flows): the edited photo, or null when closed. */
export const reviewPhoto = async (
  image: PickedImage | null,
  opts: PickOptions = PHOTO_PICK,
  review: ReviewOptions = {},
): Promise<PickedImage | null> => {
  if (!image) return null;
  const r = await reviewPhotos([image], opts, review);
  return r[0] || null;
};

interface Item {
  orig: PickedImage;
  cur: PickedImage;
  mode: PhotoBgMode;
  level: number;
  faces: boolean;
  adjust: AdjustState | null;
  baseUri: string | null;
  msg: string | null;
}

const fresh = (p: PickedImage): Item => ({
  orig: p,
  cur: p,
  mode: 'off',
  level: 3,
  faces: false,
  adjust: null,
  baseUri: null,
  msg: null,
});

export default function PhotoReviewHost() {
  const lang = useAppLanguage();
  const insets = useSafeAreaInsets();
  const [req, setReq] = useState<Request | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const reqRef = useRef<Request | null>(null);

  useEffect(() => {
    show = r => {
      // A second request while one is open: finish the first unchanged
      reqRef.current?.resolve(reqRef.current.images);
      reqRef.current = r;
      setReq(r);
      setItems(r.images.map(fresh));
      setIndex(0);
      setBusy(false);
      setAdjustOpen(false);
    };
    return () => {
      show = null;
      reqRef.current?.resolve(reqRef.current.images);
      reqRef.current = null;
    };
  }, []);

  const finish = (out: PickedImage[]) => {
    const r = reqRef.current;
    reqRef.current = null;
    setReq(null);
    setItems([]);
    setAdjustOpen(false);
    r?.resolve(out);
  };

  const item = items[index];
  const canBg = !!req?.review.bg && isPhotoBgSupported();

  const remake = async (i: number, change: Partial<Item>) => {
    const r = reqRef.current;
    const it = items[i];
    if (!r || !it || busy) return;
    const next: Item = { ...it, ...change, msg: null };
    if (!next.orig.uri) return;
    setItems(prev => prev.map((x, k) => (k === i ? next : x)));
    setBusy(true);
    try {
      const crop = next.adjust && !isFullCrop(next.adjust.crop) ? next.adjust.crop : null;
      const plain = next.mode === 'off' && !next.faces && !crop;
      const p = plain
        ? next.orig
        : await remakeImage(next.orig.uri!, { mode: next.mode, level: next.level, blurFaces: next.faces, crop }, r.opts);
      const msg = next.faces ? faceMessage(p?.faces, lang) : null;
      setItems(prev =>
        prev.map((x, k) =>
          k === i ? { ...next, cur: p || x.cur, baseUri: plain ? null : p?.baseUri || null, msg: p ? msg : photoText('tooLarge', lang) } : x,
        ),
      );
    } catch (e: any) {
      setItems(prev => prev.map((x, k) => (k === i ? { ...x, msg: e?.message || 'Could not change the photo.' } : x)));
    } finally {
      setBusy(false);
    }
  };

  if (!req || !item) return null;
  const many = items.length > 1;
  const adjusted = !!item.adjust && !isFullCrop(item.adjust.crop);
  const label = (m: PhotoBgMode) => photoText(m === 'off' ? 'original' : m === 'blur' ? 'blur' : 'removeBg', lang);

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={() => finish([])} statusBarTranslucent>
      <StatusBar barStyle="light-content" {...(Platform.OS === 'android' ? { backgroundColor: '#000' } : {})} />
      <View style={[styles.root, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 10 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => finish([])} accessibilityLabel="Close" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {photoText('photoOptions', lang)}
            {many ? `  ${index + 1} / ${items.length}` : ''}
          </Text>
          <View style={styles.headerSpace} />
        </View>

        <View style={styles.stage}>
          {/* Full-size processed photo (Blur / Remove BG / Blur face / Adjust), never the small feed copy */}
          <Image source={{ uri: item.cur.fileUri || item.cur.dataUri || item.cur.clearUri }} style={styles.photo} resizeMode="contain" />
          {busy ? (
            <View style={styles.busy}>
              <ActivityIndicator color="#FFF" size="large" />
            </View>
          ) : null}
        </View>

        {many ? (
          <ScrollView horizontal style={styles.strip} contentContainerStyle={styles.stripContent} showsHorizontalScrollIndicator={false}>
            {items.map((x, k) => (
              <TouchableOpacity key={k} onPress={() => !busy && setIndex(k)} style={[styles.thumbWrap, k === index && styles.thumbOn]}>
                <Image source={{ uri: x.cur.thumbUri || x.cur.dataUri }} style={styles.thumb} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}

        {item.msg ? <Text style={styles.msg}>{item.msg}</Text> : null}

        <View style={styles.row}>
          {canBg
            ? PHOTO_BG_MODES.slice()
                .reverse()
                .map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.chip, item.mode === m && styles.chipOn]}
                    disabled={busy}
                    onPress={() => remake(index, { mode: m })}>
                    <Text style={[styles.chipText, item.mode === m && styles.chipTextOn]}>{label(m)}</Text>
                  </TouchableOpacity>
                ))
            : null}
          <TouchableOpacity style={[styles.chip, adjusted && styles.chipOn]} disabled={busy} onPress={() => setAdjustOpen(true)}>
            <Text style={[styles.chipText, adjusted && styles.chipTextOn]}>
              {adjusted ? '✓ ' : '⤢ '}
              {photoText('adjust', lang)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, item.faces && styles.chipOn]}
            disabled={busy}
            onPress={() => remake(index, { faces: !item.faces })}
            accessibilityRole="switch"
            accessibilityState={{ checked: item.faces }}>
            <Text style={[styles.chipText, item.faces && styles.chipTextOn]}>
              {item.faces ? '✓ ' : '🙂 '}
              {photoText('blurFace', lang)}
            </Text>
          </TouchableOpacity>
        </View>

        {canBg && item.mode === 'blur' ? (
          <View style={styles.row}>
            <TouchableOpacity
              style={styles.step}
              disabled={busy || item.level <= 1}
              onPress={() => remake(index, { level: item.level - 1 })}
              accessibilityLabel="Less blur">
              <Text style={styles.stepText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.level}>
              {'●'.repeat(item.level)}
              {'○'.repeat(5 - item.level)}
            </Text>
            <TouchableOpacity
              style={styles.step}
              disabled={busy || item.level >= 5}
              onPress={() => remake(index, { level: item.level + 1 })}
              accessibilityLabel="More blur">
              <Text style={styles.stepText}>＋</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity style={[styles.use, busy && styles.useOff]} disabled={busy} onPress={() => finish(items.map(x => x.cur))}>
          <Text style={styles.useText}>{many ? photoText('usePhotos', lang, items.length) : photoText('usePhoto', lang)}</Text>
        </TouchableOpacity>
      </View>

      <PhotoAdjustModal
        visible={adjustOpen}
        uri={item.baseUri || item.orig.dataUri}
        initial={item.adjust}
        lang={lang}
        onCancel={() => setAdjustOpen(false)}
        onApply={st => {
          setAdjustOpen(false);
          remake(index, { adjust: isFullCrop(st.crop) ? null : st });
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44 },
  close: { color: '#FFF', fontSize: 22, fontWeight: '700' },
  title: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  headerSpace: { width: 22 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  photo: { width: '100%', height: '100%' },
  busy: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  strip: { flexGrow: 0, marginTop: 8 },
  stripContent: { paddingHorizontal: 12 },
  thumbWrap: { borderWidth: 2, borderColor: 'transparent', borderRadius: 8, marginHorizontal: 3, overflow: 'hidden' },
  thumbOn: { borderColor: '#FFF' },
  thumb: { width: 52, height: 52 },
  msg: { color: '#FFD479', textAlign: 'center', marginTop: 8, fontSize: 13, paddingHorizontal: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', marginTop: 10, paddingHorizontal: 8 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    margin: 4,
  },
  chipOn: { backgroundColor: '#FFF', borderColor: '#FFF' },
  chipText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  chipTextOn: { color: '#1A1040' },
  step: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  stepText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  level: { color: '#FFF', fontSize: 14, letterSpacing: 2 },
  use: { marginTop: 14, marginHorizontal: 20, backgroundColor: '#6C5CE7', borderRadius: 24, paddingVertical: 13, alignItems: 'center' },
  useOff: { opacity: 0.6 },
  useText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
});
