import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  TextInput,
  Image,
  Alert,
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';

const CATEGORIES = [
  { id: '1', icon: '👔', label: 'Tops' },
  { id: '2', icon: '👗', label: 'Dresses' },
  { id: '3', icon: '👖', label: 'Bottoms' },
  { id: '4', icon: '🧥', label: 'Outerwear' },
  { id: '5', icon: '👟', label: 'Sneakers' },
  { id: '6', icon: '👠', label: 'Heels' },
  { id: '7', icon: '👜', label: 'Bags' },
  { id: '8', icon: '💍', label: 'Accessories' },
];

const COLOR_SWATCHES = [
  { label: 'White',   hex: '#FFFFFF', border: '#D0CBDF' },
  { label: 'Black',   hex: '#1A1A1A', border: '#1A1A1A' },
  { label: 'Grey',    hex: '#9E9EA8', border: '#9E9EA8' },
  { label: 'Beige',   hex: '#D4B896', border: '#D4B896' },
  { label: 'Brown',   hex: '#8B5E3C', border: '#8B5E3C' },
  { label: 'Navy',    hex: '#1B2A6B', border: '#1B2A6B' },
  { label: 'Blue',    hex: '#4A90D9', border: '#4A90D9' },
  { label: 'Green',   hex: '#4CAF50', border: '#4CAF50' },
  { label: 'Olive',   hex: '#808000', border: '#808000' },
  { label: 'Red',     hex: '#E53935', border: '#E53935' },
  { label: 'Pink',    hex: '#EC407A', border: '#EC407A' },
  { label: 'Yellow',  hex: '#FDD835', border: '#FDD835' },
  { label: 'Orange',  hex: '#FF7043', border: '#FF7043' },
  { label: 'Purple',  hex: '#7B1FA2', border: '#7B1FA2' },
  { label: 'Multi',   hex: '#E8E8E8', border: '#D0CBDF' },
];

const FABRIC_TYPES = ['Body Con', 'Formal', 'Casual', 'Party', 'Ethnic', 'Sports'];

interface AddItemScreenProps {
  navigation: any;
  onSave?: (item: {
    name: string;
    category: string;
    categoryIcon: string;
    color: string;
    fabric: string;
  }) => void;
}

export default function AddItemScreen({ navigation, onSave }: AddItemScreenProps) {
  const [imageUri, setImageUri]               = useState<string | null>(null);
  const [itemName, setItemName]               = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedColor, setSelectedColor]       = useState<string | null>(null);
  const [selectedFabric, setSelectedFabric]     = useState<string | null>(null);
  const [nameError, setNameError]               = useState('');
  const [catError, setCatError]                 = useState(false);

  // ── Image picker ────────────────────────────────────────────────────────
  const openCamera = () => {
    launchCamera(
      { mediaType: 'photo', quality: 1, saveToPhotos: false, includeBase64: false },
      res => {
        if (res.didCancel) return;
        if (res.errorCode) {
          Alert.alert('Camera Error', res.errorMessage || `Error: ${res.errorCode}`);
          return;
        }
        const uri = res.assets?.[0]?.uri;
        if (uri) setImageUri(uri);
      },
    );
  };

  const openGallery = () => {
    launchImageLibrary(
      { mediaType: 'photo', quality: 1, selectionLimit: 1, includeBase64: false },
      res => {
        if (res.didCancel) return;
        if (res.errorCode) {
          Alert.alert('Gallery Error', res.errorMessage || `Error: ${res.errorCode}`);
          return;
        }
        const uri = res.assets?.[0]?.uri;
        if (uri) setImageUri(uri);
      },
    );
  };

  const handlePickImage = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Gallery'],
          cancelButtonIndex: 0,
        },
        index => {
          if (index === 1) openCamera();
          if (index === 2) openGallery();
        },
      );
    } else {
      Alert.alert(
        'Upload Photo',
        'Choose how you want to add a photo',
        [
          { text: 'Camera',  onPress: openCamera },
          { text: 'Gallery', onPress: openGallery },
          { text: 'Cancel',  style: 'cancel' },
        ],
        { cancelable: true },
      );
    }
  };

  const handleSave = () => {
    let valid = true;
    if (!itemName.trim()) { setNameError('Please enter an item name'); valid = false; }
    if (!selectedCategory) { setCatError(true); valid = false; }
    if (!valid) return;

    const cat = CATEGORIES.find(c => c.label === selectedCategory)!;
    navigation?.navigate('WardrobeMain', {
      savedItem: {
        name: itemName.trim(),
        category: selectedCategory!,
        categoryIcon: cat.icon,
        color: selectedColor || '#F8F8F8',
        fabric: selectedFabric || '',
      },
    });
  };

  const selectedCat = CATEGORIES.find(c => c.label === selectedCategory);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar
        barStyle="dark-content"
        {...(Platform.OS === 'android' ? { backgroundColor: '#FAFAFA' } : {})}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()} activeOpacity={0.7}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upload Clothing</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        <Text style={styles.introText}>
          Upload a photo and fill in the details to add this item to your wardrobe. All fields are available below.
        </Text>

        {/* Image Upload Zone */}
        <TouchableOpacity style={styles.uploadZone} activeOpacity={0.8} onPress={handlePickImage}>
          {imageUri ? (
            <>
              <Image source={{ uri: imageUri }} style={styles.uploadedImage} resizeMode="cover" />
              <View style={styles.changePhotoOverlay}>
                <Text style={styles.changePhotoText}>📷  Change Photo</Text>
              </View>
            </>
          ) : (
            <View style={styles.uploadPlaceholder}>
              <View style={styles.uploadIconCircle}>
                <Text style={styles.uploadIcon}>📷</Text>
              </View>
              <Text style={styles.uploadTitle}>Upload Clothing Photo</Text>
              <Text style={styles.uploadSubtitle}>Tap to take a photo or choose from gallery</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Item Name */}
        <Text style={styles.sectionLabel}>ITEM NAME</Text>
        <TextInput
          style={[styles.textInput, nameError ? styles.textInputError : null]}
          placeholder="e.g. White Oxford Shirt"
          placeholderTextColor="#B0AECB"
          value={itemName}
          onChangeText={t => { setItemName(t); setNameError(''); }}
          returnKeyType="done"
        />
        {nameError ? <Text style={styles.errorMsg}>{nameError}</Text> : null}

        {/* Category */}
        <Text style={[styles.sectionLabel, catError && styles.sectionLabelError]}>
          {catError ? 'CATEGORY — please select one' : 'CATEGORY'}
        </Text>
        <View style={styles.chipWrap}>
          {CATEGORIES.map(cat => {
            const active = selectedCategory === cat.label;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => { setSelectedCategory(cat.label); setCatError(false); }}
                activeOpacity={0.8}>
                <Text style={styles.chipEmoji}>{cat.icon}</Text>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Colour */}
        <Text style={styles.sectionLabel}>COLOUR</Text>
        <View style={styles.swatchGrid}>
          {COLOR_SWATCHES.map(sw => {
            const active = selectedColor === sw.hex;
            return (
              <TouchableOpacity
                key={sw.hex}
                style={[
                  styles.swatch,
                  { backgroundColor: sw.hex, borderColor: active ? colors.primary : sw.border },
                  active && styles.swatchActive,
                ]}
                onPress={() => setSelectedColor(sw.hex)}
                activeOpacity={0.8}
              />
            );
          })}
        </View>
        {selectedColor ? (
          <Text style={styles.colorName}>
            {COLOR_SWATCHES.find(s => s.hex === selectedColor)?.label}
          </Text>
        ) : null}

        {/* Fabric Type */}
        <Text style={styles.sectionLabel}>FABRIC TYPE</Text>
        <View style={styles.chipWrap}>
          {FABRIC_TYPES.map(fab => {
            const active = selectedFabric === fab;
            return (
              <TouchableOpacity
                key={fab}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelectedFabric(active ? null : fab)}
                activeOpacity={0.8}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{fab}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Live Preview */}
        {itemName.trim() && selectedCategory ? (
          <View style={styles.previewCard}>
            <View style={[styles.previewThumb, { backgroundColor: selectedColor || '#F5F0FF' }]}>
              <Text style={styles.previewEmoji}>{selectedCat?.icon}</Text>
            </View>
            <View style={styles.previewInfo}>
              <Text style={styles.previewName}>{itemName.trim()}</Text>
              <Text style={styles.previewMeta}>
                {selectedCategory}{selectedFabric ? ` · ${selectedFabric}` : ''}
              </Text>
            </View>
            {selectedColor ? (
              <View style={[styles.previewColorDot, { backgroundColor: selectedColor }]} />
            ) : null}
          </View>
        ) : null}

        {/* Save Button */}
        <TouchableOpacity style={styles.saveBtn} activeOpacity={0.85} onPress={handleSave}>
          <Text style={styles.saveBtnText}>SAVE TO MY WARDROBE</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAFA' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 48, paddingHorizontal: spacing.base },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#EBE9F3',
    backgroundColor: '#FAFAFA',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0EDF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 18, color: '#3D3070', lineHeight: 20 },
  headerTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: '#0A1940',
    letterSpacing: 0.2,
  },

  introText: {
    fontSize: 12,
    color: '#8E8EA8',
    lineHeight: 18,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },

  uploadZone: {
    borderWidth: 2,
    borderColor: '#C8C0E8',
    borderStyle: 'dashed',
    borderRadius: 16,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F6FF',
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  uploadPlaceholder: { alignItems: 'center', gap: 8 },
  uploadIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EDE8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  uploadIcon: { fontSize: 24 },
  uploadTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: '#3D3070' },
  uploadSubtitle: { fontSize: 11, color: '#9E9EBA' },

  uploadedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  changePhotoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.42)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  changePhotoText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: fontWeight.bold,
  },

  sectionLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: '#6B6B8A',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: spacing.lg,
  },
  sectionLabelError: { color: '#E91E63' },

  textInput: {
    borderWidth: 1.5,
    borderColor: '#E0DBF0',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: fontSize.base,
    color: '#0A1940',
    backgroundColor: '#FFFFFF',
  },
  textInputError: { borderColor: '#F48FB1' },
  errorMsg: { fontSize: 11, color: '#E91E63', fontWeight: fontWeight.semiBold, marginTop: 4 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E0DBF0',
    backgroundColor: '#FFFFFF',
  },
  chipActive: { backgroundColor: '#E91E63', borderColor: '#E91E63' },
  chipEmoji: { fontSize: 13 },
  chipText: { fontSize: 12, fontWeight: fontWeight.semiBold, color: '#4A4A6A' },
  chipTextActive: { color: '#FFFFFF' },

  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 6 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2 },
  swatchActive: { borderWidth: 3, borderColor: colors.primary, transform: [{ scale: 1.2 }] },
  colorName: { fontSize: 11, color: '#6B6B8A', fontWeight: fontWeight.semiBold, marginBottom: spacing.sm },

  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: spacing.md,
    marginTop: spacing.lg,
    borderWidth: 1.5,
    borderColor: '#EDE8FF',
    shadowColor: 'rgba(10,25,64,0.06)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  previewThumb: { width: 50, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  previewEmoji: { fontSize: 26 },
  previewInfo: { flex: 1, marginLeft: 12 },
  previewName: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: '#0A1940' },
  previewMeta: { fontSize: 12, color: '#6B6B8A', marginTop: 2 },
  previewColorDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#E0DBF0' },

  saveBtn: {
    backgroundColor: '#E91E63',
    borderRadius: borderRadius.full,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.xl,
    shadowColor: 'rgba(233,30,99,0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 5,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: fontWeight.bold, letterSpacing: 1.2 },
});
