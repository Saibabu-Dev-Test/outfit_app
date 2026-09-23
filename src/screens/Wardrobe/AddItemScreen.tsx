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
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { addWardrobeItem as apiAddWardrobeItem } from '../../services/wardrobeApi';

interface CategoryItem {
  id: string;
  icon: string;
  label: string;
}

interface CategoryGroup {
  id: string;
  title: string;
  items: CategoryItem[];
}

const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: 'tops',
    title: 'TOPS',
    items: [
      { id: 'shirts', icon: '👔', label: 'Shirts' },
      { id: 'tshirts', icon: '👕', label: 'T-Shirts' },
      { id: 'polos', icon: '👕', label: 'Polos' },
      { id: 'kurtas', icon: '👔', label: 'Kurtas' },
      { id: 'hoodies', icon: '🧥', label: 'Hoodies' },
      { id: 'sweaters', icon: '🧶', label: 'Sweaters' },
      { id: 'jackets', icon: '🧥', label: 'Jackets' },
      { id: 'blazers', icon: '🧥', label: 'Blazers' },
      { id: 'coats', icon: '🧥', label: 'Coats' },
    ],
  },
  {
    id: 'bottoms',
    title: 'BOTTOMS',
    items: [
      { id: 'pants', icon: '👖', label: 'Pants' },
      { id: 'jeans', icon: '👖', label: 'Jeans' },
      { id: 'trousers', icon: '👖', label: 'Trousers' },
      { id: 'chinos', icon: '👖', label: 'Chinos' },
      { id: 'shorts', icon: '🩳', label: 'Shorts' },
      { id: 'trackpants', icon: '👖', label: 'Track Pants' },
    ],
  },
  {
    id: 'onepiece',
    title: 'ONE-PIECE',
    items: [
      { id: 'jumpsuits', icon: '👗', label: 'Jumpsuits' },
    ],
  },
  {
    id: 'footwear',
    title: 'FOOTWEAR',
    items: [
      { id: 'shoes', icon: '👟', label: 'Shoes' },
      { id: 'sandals', icon: '👡', label: 'Sandals' },
      { id: 'boots', icon: '🥾', label: 'Boots' },
      { id: 'sportsshoes', icon: '👟', label: 'Sports Shoes' },
      { id: 'slippers', icon: '🥿', label: 'Slippers' },
    ],
  },
  {
    id: 'accessories',
    title: 'ACCESSORIES',
    items: [
      { id: 'watches', icon: '⌚', label: 'Watches' },
      { id: 'belts', icon: '🥋', label: 'Belts' },
      { id: 'caps', icon: '🧢', label: 'Caps' },
      { id: 'sunglasses', icon: '🕶️', label: 'Sunglasses' },
      { id: 'bags', icon: '👜', label: 'Bags' },
      { id: 'wallets', icon: '👛', label: 'Wallets' },
      { id: 'acc_other', icon: '💍', label: 'Accessories' },
    ],
  },
];

const WEAR_TYPES = ['Daily Wear', 'Formal', 'Casual'];

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

const FABRIC_TYPES = [ 'Formal', 'Casual', 'Party', 'Ethnic', 'Sports'];

interface AddItemScreenProps {
  navigation: any;
  onSave?: (item: {
    name: string;
    category: string;
    subCategory?: string;
    wearType?: string;
    categoryIcon: string;
    color: string;
    fabric: string;
  }) => void;
}

export default function AddItemScreen({ navigation, onSave }: AddItemScreenProps) {
  const { user } = useAuth();

  const [imageUri, setImageUri]               = useState<string | null>(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [itemName, setItemName]               = useState('');
  const [selectedCategory, setSelectedCategory]   = useState<string | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
  const [selectedWearType, setSelectedWearType]   = useState<string>('Daily Wear');
  const [selectedColor, setSelectedColor]       = useState<string | null>(null);
  const [selectedFabric, setSelectedFabric]     = useState<string | null>(null);
  const [nameError, setNameError]               = useState('');
  const [catError, setCatError]                 = useState(false);
  const [saving, setSaving]                     = useState(false);

  // Helper to find selected item icon
  const getSelectedIcon = () => {
    if (!selectedSubCategory) return '👕';
    for (const grp of CATEGORY_GROUPS) {
      const found = grp.items.find(i => i.label === selectedSubCategory);
      if (found) return found.icon;
    }
    return '👕';
  };

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

  const handleSave = async () => {
    const finalName = itemName.trim() || selectedSubCategory || '';
    let valid = true;
    if (!finalName) { setNameError('Please select or enter an item name'); valid = false; }
    if (!selectedCategory) { setCatError(true); valid = false; }
    if (!valid) return;

    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to add items.');
      return;
    }

    const icon = getSelectedIcon();

    setSaving(true);
    try {
      const savedItem = await apiAddWardrobeItem({
        userId: user.id,
        name: finalName,
        category: selectedCategory!,
        subCategory: selectedSubCategory || undefined,
        wearType: selectedWearType || undefined,
        color: selectedColor || undefined,
        fabric: selectedFabric || undefined,
        imageUri: imageUri || undefined,
      });

      if (onSave) {
        onSave({
          name: savedItem.name,
          category: savedItem.category,
          subCategory: savedItem.subCategory || undefined,
          wearType: savedItem.wearType || undefined,
          categoryIcon: icon,
          color: savedItem.color || '#F8F8F8',
          fabric: savedItem.fabric || '',
        });
      }

      navigation?.navigate('WardrobeMain', {
        savedItem: {
          name: savedItem.name,
          category: savedItem.category,
          subCategory: savedItem.subCategory,
          wearType: savedItem.wearType,
          categoryIcon: icon,
          color: savedItem.color || '#F8F8F8',
          fabric: savedItem.fabric || '',
          imageUrl: savedItem.imageUrl || null,
          id: savedItem.id,
        },
      });
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Could not save item. Please try again.');
    } finally {
      setSaving(false);
    }
  };

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

      {/* Fixed Image Upload Block (stays fixed while form below scrolls) */}
      <View style={styles.fixedTopSection}>
        <Text style={styles.introText}>
          Upload a photo and choose a category, item name, and wear type to add to your wardrobe.
        </Text>

        <View style={styles.uploadZone}>
          {imageUri ? (
            <>
              <TouchableOpacity
                style={styles.imagePreviewTouch}
                activeOpacity={0.9}
                onPress={() => setIsPreviewVisible(true)}>
                <Image source={{ uri: imageUri }} style={styles.uploadedImage} resizeMode="cover" />
              </TouchableOpacity>
              <View style={styles.photoOverlayBar}>
                <TouchableOpacity style={styles.overlayBtn} activeOpacity={0.8} onPress={handlePickImage}>
                  <Text style={styles.overlayBtnText}>📷 Change Photo</Text>
                </TouchableOpacity>
                <View style={styles.overlayDivider} />
                <TouchableOpacity style={styles.overlayBtn} activeOpacity={0.8} onPress={() => setIsPreviewVisible(true)}>
                  <Text style={styles.overlayBtnText}>🔍 Fullscreen Preview</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity style={styles.uploadPlaceholderTouch} activeOpacity={0.8} onPress={handlePickImage}>
              <View style={styles.uploadPlaceholder}>
                <View style={styles.uploadIconCircle}>
                  <Text style={styles.uploadIcon}>📷</Text>
                </View>
                <Text style={styles.uploadTitle}>Upload Clothing Photo</Text>
                <Text style={styles.uploadSubtitle}>Tap to take a photo or choose from gallery</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Scrollable Form Fields */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* CATEGORY Section */}
        <Text style={[styles.mainSectionTitle, catError && styles.sectionLabelError]}>
          {catError ? 'CATEGORY — please select one item' : 'CATEGORY'}
        </Text>

        {CATEGORY_GROUPS.map(group => (
          <View key={group.id} style={styles.groupCard}>
            <Text style={styles.groupHeaderTitle}>{group.title}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipScrollContainer}>
              {group.items.map(item => {
                const isSelected = selectedSubCategory === item.label;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.itemChip, isSelected && styles.itemChipSelected]}
                    onPress={() => {
                      setSelectedCategory(group.title);
                      setSelectedSubCategory(item.label);
                      setCatError(false);
                      if (!itemName.trim() || CATEGORY_GROUPS.some(g => g.items.some(i => i.label === itemName))) {
                        setItemName(item.label);
                      }
                      setNameError('');
                    }}
                    activeOpacity={0.75}>
                    <Text style={styles.chipEmoji}>{item.icon}</Text>
                    <Text style={[styles.itemChipText, isSelected && styles.itemChipTextSelected]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ))}

        {/* WEAR TYPE Section */}
        <Text style={styles.mainSectionTitle}>WEAR TYPE</Text>
        <View style={styles.wearTypeWrap}>
          {WEAR_TYPES.map(type => {
            const isSelected = selectedWearType === type;
            return (
              <TouchableOpacity
                key={type}
                style={[styles.wearTypeChip, isSelected && styles.wearTypeChipSelected]}
                onPress={() => setSelectedWearType(type)}
                activeOpacity={0.8}>
                <Text style={[styles.wearTypeText, isSelected && styles.wearTypeTextSelected]}>
                  {type}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Item Name Input (Optional custom display name) */}
        <Text style={styles.mainSectionTitle}>CUSTOM ITEM NAME (OPTIONAL)</Text>
        <View style={[styles.textInputWrap, nameError ? styles.textInputError : null]}>
          <TextInput
            style={styles.textInput}
            placeholder={selectedSubCategory ? `Name e.g. "My favorite ${selectedSubCategory}"` : 'Enter custom item name…'}
            placeholderTextColor="#B0AECB"
            value={itemName}
            onChangeText={t => { setItemName(t); setNameError(''); }}
            returnKeyType="done"
          />
        </View>
        {nameError ? <Text style={styles.errorMsg}>{nameError}</Text> : null}

        {/* Colour */}
        <Text style={styles.mainSectionTitle}>COLOUR</Text>
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
        <Text style={styles.mainSectionTitle}>FABRIC TYPE</Text>
        <View style={styles.fabricWrap}>
          {FABRIC_TYPES.map(fab => {
            const active = selectedFabric === fab;
            return (
              <TouchableOpacity
                key={fab}
                style={[styles.fabricChip, active && styles.fabricChipActive]}
                onPress={() => setSelectedFabric(active ? null : fab)}
                activeOpacity={0.8}>
                <Text style={[styles.fabricChipText, active && styles.fabricChipTextActive]}>{fab}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Live Preview */}
        {(selectedSubCategory || itemName.trim()) && selectedCategory ? (
          <View style={styles.previewCard}>
            <View style={[styles.previewThumb, { backgroundColor: selectedColor || '#F5F0FF' }]}>
              <Text style={styles.previewEmoji}>{getSelectedIcon()}</Text>
            </View>
            <View style={styles.previewInfo}>
              <Text style={styles.previewName}>{itemName.trim() || selectedSubCategory}</Text>
              <Text style={styles.previewMeta}>
                {selectedCategory} · {selectedSubCategory || 'Item'} · {selectedWearType}
                {selectedFabric ? ` · ${selectedFabric}` : ''}
              </Text>
            </View>
            {selectedColor ? (
              <View style={[styles.previewColorDot, { backgroundColor: selectedColor }]} />
            ) : null}
          </View>
        ) : null}

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          activeOpacity={0.85}
          onPress={handleSave}
          disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>SAVE TO MY WARDROBE</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Full Screen Image Preview Modal */}
      <Modal
        visible={isPreviewVisible}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setIsPreviewVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <StatusBar
            barStyle="light-content"
            {...(Platform.OS === 'android' ? { backgroundColor: '#000000' } : {})}
          />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Image Preview</Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setIsPreviewVisible(false)}
              activeOpacity={0.7}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalImageWrapper}>
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </SafeAreaView>
      </Modal>
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

  fixedTopSection: {
    paddingHorizontal: spacing.base,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#EBE9F3',
    paddingBottom: spacing.xs,
  },
  introText: {
    fontSize: 12,
    color: '#8E8EA8',
    lineHeight: 18,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },

  uploadZone: {
    borderWidth: 2,
    borderColor: '#C8C0E8',
    borderStyle: 'dashed',
    borderRadius: 16,
    height: 160,
    backgroundColor: '#F8F6FF',
    marginBottom: spacing.xs,
    overflow: 'hidden',
    position: 'relative',
  },
  uploadPlaceholderTouch: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadPlaceholder: { alignItems: 'center', gap: 6 },
  uploadIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDE8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadIcon: { fontSize: 20 },
  uploadTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: '#3D3070' },
  uploadSubtitle: { fontSize: 11, color: '#9E9EBA' },

  imagePreviewTouch: {
    width: '100%',
    height: '100%',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  photoOverlayBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  overlayBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  overlayBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: fontWeight.bold,
  },
  overlayDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  modalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: fontWeight.bold,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#222222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: fontWeight.bold,
  },
  modalImageWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },

  mainSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4A4A6A',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: 10,
  },
  sectionLabelError: { color: '#E91E63' },

  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    shadowColor: 'rgba(0,0,0,0.02)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  groupHeaderTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  chipScrollContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
  },
  itemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  itemChipSelected: {
    backgroundColor: '#E91E63',
    borderColor: '#E91E63',
  },
  chipEmoji: {
    fontSize: 14,
  },
  itemChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  itemChipTextSelected: {
    color: '#FFFFFF',
  },

  wearTypeWrap: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.md,
  },
  wearTypeChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wearTypeChipSelected: {
    backgroundColor: '#0D0D0D',
    borderColor: '#0D0D0D',
  },
  wearTypeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  wearTypeTextSelected: {
    color: '#FFFFFF',
  },

  textInputWrap: {
    borderWidth: 1.5,
    borderColor: '#E0DBF0',
    borderRadius: borderRadius.md,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
  },
  textInput: {
    paddingVertical: 12,
    fontSize: fontSize.base,
    color: '#0A1940',
  },
  textInputError: { borderColor: '#F48FB1' },
  errorMsg: { fontSize: 11, color: '#E91E63', fontWeight: fontWeight.semiBold, marginTop: 4 },

  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 6 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2 },
  swatchActive: { borderWidth: 3, borderColor: colors.primary, transform: [{ scale: 1.2 }] },
  colorName: { fontSize: 11, color: '#6B6B8A', fontWeight: fontWeight.semiBold, marginBottom: spacing.sm },

  fabricWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fabricChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E0DBF0',
    backgroundColor: '#FFFFFF',
  },
  fabricChipActive: { backgroundColor: '#E91E63', borderColor: '#E91E63' },
  fabricChipText: { fontSize: 12, fontWeight: fontWeight.semiBold, color: '#4A4A6A' },
  fabricChipTextActive: { color: '#FFFFFF' },

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
  saveBtnDisabled: { opacity: 0.65 },
});
