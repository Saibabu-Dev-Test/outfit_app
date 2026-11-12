import React, { useEffect, useState } from 'react';
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
  Switch,
} from 'react-native';
import KeyboardSafeView from '../../components/KeyboardSafeView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles, statusBarStyle } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import {
  addWardrobeItem as apiAddWardrobeItem,
  updateWardrobeItem as apiUpdateWardrobeItem,
  analyzeClothingPhoto,
  getWardrobeFullImage,
} from '../../services/wardrobeApi';
import { pickImage } from '../../utils/imagePicker';
import {
  CATEGORY_GROUPS,
  categoryGroupsForGender,
  ALL_CATEGORIES,
  SHOE_TYPES,
  ACCESSORY_TYPES,
  typeLabel,
  groupOfCategory,
  normalizeCategory,
  resolveCategory,
  itemSubType,
  categoryIcon,
  COLOR_SWATCHES,
  WEAR_TYPES,
  colorNameFromHex,
} from '../../constants/wardrobe';

// Labels the item name may be auto-filled with (replaced when the pick changes)
const AUTO_NAMES = new Set([...ALL_CATEGORIES, ...SHOE_TYPES, ...ACCESSORY_TYPES]);

const FABRIC_TYPES = [ 'Formal', 'Casual', 'Party', 'Ethnic', 'Sports'];

interface AddItemScreenProps {
  navigation: any;
  route?: any;
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

export default function AddItemScreen({ navigation, route, onSave }: AddItemScreenProps) {
  const { user } = useAuth();
  const itemToEdit = route?.params?.itemToEdit;
  const isEditing = Boolean(itemToEdit?.id);

  // Category picker: first a group (Tops / Bottoms / Ethnic & Dresses / Shoes / Accessories / Others),
  // then that group's categories, or the Shoes / Accessories types. Old values map in (Footwear -> Shoes).
  const initialRaw: string | null = itemToEdit?.category || route?.params?.category || null;
  const initialCategory: string | null = initialRaw ? normalizeCategory(initialRaw) : null;
  const initialSubType: string | null = itemToEdit
    ? itemSubType(itemToEdit) || null
    : route?.params?.subType || (initialRaw ? resolveCategory(initialRaw)?.subType : null) || null;
  // Old items may hold a hex in color; normalise to a swatch name
  const initialColor: string | null = itemToEdit?.color
    ? (String(itemToEdit.color).startsWith('#') ? colorNameFromHex(itemToEdit.color) : itemToEdit.color)
    : null;

  // Only the user's registered gender's categories (plus unisex). Editing an item saved under a
  // category outside that list shows every category, so the item keeps its own.
  const groups = React.useMemo(() => {
    const gs = categoryGroupsForGender(user?.gender);
    if (initialCategory && !gs.some(g => g.categories.includes(initialCategory))) return CATEGORY_GROUPS;
    if (initialSubType && !gs.some(g => !g.subTypes || g.subTypes.includes(initialSubType))) return CATEGORY_GROUPS;
    return gs;
  }, [user?.gender, initialCategory, initialSubType]);

  // imageUri holds a base64 data URI (new photo) or the saved imageData
  const [imageUri, setImageUri]               = useState<string | null>(itemToEdit?.imageUrl || null);
  const [imageThumb, setImageThumb]           = useState<string | null>(null);
  const [imageClear, setImageClear]           = useState<string | null>(null);
  const [imageChanged, setImageChanged]       = useState(false);
  // Editing: the list holds the thumbnail; show the full photo (1 read) once it loads
  useEffect(() => {
    if (!itemToEdit?.hasMedia) return;
    let alive = true;
    getWardrobeFullImage(itemToEdit).then(full => {
      if (alive && full) setImageUri(prev => (prev === itemToEdit.imageUrl ? full : prev));
    });
    return () => {
      alive = false;
    };
  }, [itemToEdit]);
  // New items from a public profile default to the public feed
  const [isPublic, setIsPublic]               = useState<boolean>(
    itemToEdit ? itemToEdit.isPublic === true : user?.isPublic !== false,
  );
  const [colorError, setColorError]           = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [itemName, setItemName]               = useState(itemToEdit?.name || '');
  const [selectedGroupKey, setSelectedGroupKey]   = useState<string>(
    initialCategory ? groupOfCategory(initialCategory).key : groups[0].key,
  );
  const [selectedCategory, setSelectedCategory]   = useState<string | null>(initialCategory);
  const [selectedSubType, setSelectedSubType]     = useState<string | null>(initialSubType);
  const [selectedSubCategory] = useState<string | null>(itemToEdit?.subCategory || null);
  const [selectedWearType, setSelectedWearType]   = useState<string>(itemToEdit?.wearType || 'Daily Wear');
  const [selectedColor, setSelectedColor]       = useState<string | null>(initialColor);
  const [selectedFabric, setSelectedFabric]     = useState<string | null>(itemToEdit?.fabric || null);
  const [nameError, setNameError]               = useState('');
  const [catError, setCatError]                 = useState(false);
  const [saving, setSaving]                     = useState(false);
  const [isAnalyzingAI, setIsAnalyzingAI]     = useState(false);
  const [aiStatusMsg, setAiStatusMsg]         = useState<string | null>(null);

  const getSelectedIcon = () => categoryIcon(selectedSubType || selectedCategory);
  const selectedGroup = groups.find(g => g.key === selectedGroupKey) || groups[0];
  const selectedLabel = selectedSubType || selectedCategory;

  // Auto-fill the item name from the pick unless the user typed their own
  const autoName = (label: string) => {
    if (!itemName.trim() || AUTO_NAMES.has(itemName)) setItemName(label);
    setNameError('');
  };

  const pickGroup = (key: string) => {
    const g = groups.find(x => x.key === key);
    if (!g) return;
    setSelectedGroupKey(key);
    if (selectedCategory && g.categories.includes(selectedCategory)) return;
    // Shoes / Accessories / Others are one category each: picking the group picks it
    if (g.subTypes || g.categories.length === 1) {
      setSelectedCategory(g.categories[0]);
      setSelectedSubType(null);
      setCatError(false);
      autoName(g.categories[0]);
    } else {
      setSelectedCategory(null);
      setSelectedSubType(null);
    }
  };

  const pickType = (label: string) => {
    if (selectedGroup.subTypes) {
      const next = selectedSubType === label ? null : label; // tap again = no type (All / Other)
      setSelectedCategory(selectedGroup.categories[0]);
      setSelectedSubType(next);
      autoName(next || selectedGroup.categories[0]);
    } else {
      setSelectedCategory(label);
      setSelectedSubType(null);
      autoName(label);
    }
    setCatError(false);
  };

  const applySuggestion = (...names: (string | null | undefined)[]): string | null => {
    for (const n of names) {
      const hit = resolveCategory(n);
      if (hit && hit.category !== 'Others') {
        setSelectedGroupKey(groupOfCategory(hit.category).key);
        setSelectedCategory(hit.category);
        setSelectedSubType(hit.subType || null);
        setCatError(false);
        return hit.subType || hit.category;
      }
    }
    return null;
  };

  // Trigger AI vision analysis to automatically set options
  const triggerAIAnalysis = async (uri: string) => {
    setIsAnalyzingAI(true);
    setAiStatusMsg(null);
    try {
      const result = await analyzeClothingPhoto(uri);
      if (!result) {
        setAiStatusMsg('Pick a category and colour below.');
        return;
      }
      const cat = applySuggestion(result.subCategory, result.category);
      if (result.wearType && WEAR_TYPES.includes(result.wearType)) setSelectedWearType(result.wearType);
      const col = COLOR_SWATCHES.find(sw => sw.label.toLowerCase() === String(result.colorName || '').toLowerCase())
        || COLOR_SWATCHES.find(sw => sw.hex.toLowerCase() === String(result.color || '').toLowerCase());
      if (col) {
        setSelectedColor(col.label);
        setColorError(false);
      }
      if (result.fabric) setSelectedFabric(result.fabric);
      if (result.name) {
        setItemName(result.name);
        setNameError('');
      }
      setAiStatusMsg(`✨ AI suggested: ${cat || result.category}${col ? ` · ${col.label}` : ''}`);
    } catch (err) {
      console.log('AI Analysis error', err);
    } finally {
      setIsAnalyzingAI(false);
    }
  };

  // ── Image picker (compressed base64, saved in Firestore) ─────────────────
  const pickFrom = async (source: 'camera' | 'library') => {
    try {
      const picked = await pickImage(source);
      if (!picked) return;
      setImageUri(picked.dataUri);
      setImageThumb(picked.thumbUri || null);
      setImageClear(picked.clearUri || null);
      setImageChanged(true);
      if (picked.uri) triggerAIAnalysis(picked.uri);
    } catch (e: any) {
      Alert.alert('Photo Error', e?.message || 'Could not use this photo.');
    }
  };
  const openCamera = () => { pickFrom('camera'); };
  const openGallery = () => { pickFrom('library'); };

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
    const finalName = itemName.trim() || selectedCategory || '';
    let valid = true;
    if (!selectedCategory) { setCatError(true); valid = false; }
    if (!selectedColor) { setColorError(true); valid = false; }
    if (!valid) {
      Alert.alert('Missing details', 'Please choose a category and a colour before saving.');
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to save items.');
      return;
    }

    const icon = getSelectedIcon();
    const hex = COLOR_SWATCHES.find(sw => sw.label === selectedColor)?.hex;

    setSaving(true);
    try {
      const payload = {
        userId: user.id,
        name: finalName,
        category: selectedCategory!,
        subCategory: selectedSubCategory || undefined,
        // Only Shoes / Accessories carry a type; '' clears an old one on edit
        subType: selectedSubType || (isEditing ? '' : undefined),
        wearType: selectedWearType || undefined,
        color: selectedColor || undefined,
        colorHex: hex,
        fabric: selectedFabric || undefined,
        gender: user.gender || undefined,
        isPublic,
        // Only send the image when it is new (avoids rewriting the same data)
        imageUri: isEditing ? (imageChanged ? imageUri : undefined) : imageUri,
        imageThumb: imageChanged || !isEditing ? imageThumb : undefined,
        imageClear: imageChanged || !isEditing ? imageClear : undefined,
      };

      const savedItem = isEditing && itemToEdit?.id
        ? await apiUpdateWardrobeItem(itemToEdit.id, payload)
        : await apiAddWardrobeItem(payload);

      if (onSave) {
        onSave({
          name: savedItem.name,
          category: savedItem.category,
          subCategory: savedItem.subCategory || undefined,
          wearType: savedItem.wearType || undefined,
          categoryIcon: icon,
          color: savedItem.colorHex || hex || '#F8F8F8',
          fabric: savedItem.fabric || '',
        });
      }

      navigation?.navigate('WardrobeMain');
    } catch (err: any) {
      Alert.alert(isEditing ? 'Update Failed' : 'Upload Failed', err?.message || 'Could not save item. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar
        barStyle={statusBarStyle()}
        {...(Platform.OS === 'android' ? { backgroundColor: '#FAFAFA' } : {})}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()} activeOpacity={0.7}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Clothing' : 'Upload Clothing'}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Fixed Image Upload Block (stays fixed while form below scrolls) */}
      <View style={styles.fixedTopSection}>
        <Text style={styles.introText}>
          Upload a photo and AI will automatically analyze it to detect and set the category, item options, and color!
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

              {/* AI Analyzing Loading Overlay */}
              {isAnalyzingAI ? (
                <View style={styles.aiAnalyzingOverlay}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.aiAnalyzingText}>✨ AI is analyzing your photo...</Text>
                  <Text style={styles.aiAnalyzingSubtext}>Auto-setting category, item name & color</Text>
                </View>
              ) : null}

              <View style={styles.photoOverlayBar}>
                <TouchableOpacity style={styles.overlayBtn} activeOpacity={0.8} onPress={handlePickImage}>
                  <Text style={styles.overlayBtnText}>📷 Change Photo</Text>
                </TouchableOpacity>
                <View style={styles.overlayDivider} />
                <TouchableOpacity
                  style={styles.overlayBtn}
                  activeOpacity={0.8}
                  onPress={() => imageUri && triggerAIAnalysis(imageUri)}>
                  <Text style={styles.overlayBtnText}>✨ AI Re-Analyze</Text>
                </TouchableOpacity>
                <View style={styles.overlayDivider} />
                <TouchableOpacity style={styles.overlayBtn} activeOpacity={0.8} onPress={() => setIsPreviewVisible(true)}>
                  <Text style={styles.overlayBtnText}>🔍 Preview</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity style={styles.uploadPlaceholderTouch} activeOpacity={0.8} onPress={handlePickImage}>
              {isAnalyzingAI ? (
                <View style={styles.uploadPlaceholder}>
                  <ActivityIndicator size="large" color="#6C5CE7" />
                  <Text style={styles.uploadTitle}>✨ AI Analyzing Photo…</Text>
                  <Text style={styles.uploadSubtitle}>Extracting categories, wear type & colors</Text>
                </View>
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <View style={styles.uploadIconCircle}>
                    <Text style={styles.uploadIcon}>📷</Text>
                  </View>
                  <Text style={styles.uploadTitle}>Upload Clothing Photo</Text>
                  <Text style={styles.uploadSubtitle}>Tap to take a photo or pick from gallery</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* AI Status Badge */}
        {aiStatusMsg ? (
          <View style={styles.aiBadgeContainer}>
            <Text style={styles.aiBadgeText}>{aiStatusMsg}</Text>
          </View>
        ) : null}
      </View>

      {/* Scrollable Form Fields */}
      <KeyboardSafeView style={styles.scroll}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* CATEGORY Section */}
        <Text style={[styles.mainSectionTitle, catError && styles.sectionLabelError]}>
          {catError ? 'CATEGORY — please select one item' : 'CATEGORY'}
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipSlider}
          contentContainerStyle={styles.chipSliderContent}>
          {groups.map(g => {
            const isSelected = selectedGroupKey === g.key;
            return (
              <TouchableOpacity
                key={g.key}
                style={[styles.pill, isSelected && styles.groupPillSelected]}
                onPress={() => pickGroup(g.key)}
                activeOpacity={0.75}>
                <Text style={styles.chipEmoji}>{g.icon}</Text>
                <Text style={[styles.itemChipText, isSelected && styles.itemChipTextSelected]}>{g.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {selectedGroup.key !== 'others' ? (
          <>
            <Text style={styles.swipeHint}>
              {selectedGroup.subTypes ? `${selectedGroup.label} type (optional) · swipe ›` : `Pick the ${selectedGroup.label.toLowerCase()} type · swipe ›`}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipSlider}
              contentContainerStyle={styles.chipSliderContent}>
              {(selectedGroup.subTypes || selectedGroup.categories).map(t => {
                const isSelected = selectedGroup.subTypes ? selectedSubType === t : selectedCategory === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.pill, styles.pillSmall, isSelected && styles.itemChipSelected]}
                    onPress={() => pickType(t)}
                    activeOpacity={0.75}>
                    <Text style={styles.chipEmojiSmall}>{categoryIcon(t)}</Text>
                    <Text style={[styles.pillText, isSelected && styles.itemChipTextSelected]}>{typeLabel(t, user?.language)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        ) : null}
        {selectedLabel ? (
          <Text style={styles.pickedText}>
            Selected: {categoryIcon(selectedLabel)} {selectedSubType ? `${selectedCategory} › ${selectedSubType}` : selectedCategory}
          </Text>
        ) : null}

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
            placeholder={selectedLabel ? `Name e.g. "My favourite ${selectedLabel}"` : 'Enter custom item name…'}
            placeholderTextColor={colors.textMuted}
            value={itemName}
            onChangeText={t => { setItemName(t); setNameError(''); }}
            returnKeyType="done"
          />
        </View>
        {nameError ? <Text style={styles.errorMsg}>{nameError}</Text> : null}

        {/* Colour */}
        <Text style={[styles.mainSectionTitle, colorError && styles.sectionLabelError]}>
          {colorError ? 'COLOUR — please select one' : 'COLOUR'}
        </Text>
        <View style={styles.swatchGrid}>
          {COLOR_SWATCHES.map(sw => {
            const active = selectedColor === sw.label;
            return (
              <TouchableOpacity
                key={sw.label}
                style={[
                  styles.swatch,
                  { backgroundColor: sw.hex, borderColor: active ? colors.primary : sw.border },
                  active && styles.swatchActive,
                ]}
                onPress={() => { setSelectedColor(sw.label); setColorError(false); }}
                activeOpacity={0.8}
              />
            );
          })}
        </View>
        {selectedColor ? (
          <Text style={styles.colorName}>
            {selectedColor}
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

        {/* Public toggle (for a later public feed) */}
        <View style={styles.publicRow}>
          <Text style={styles.publicLabel}>Show in public feed</Text>
          <Switch value={isPublic} onValueChange={setIsPublic} />
        </View>

        {/* Live Preview */}
        {selectedCategory ? (
          <View style={styles.previewCard}>
            <View style={[styles.previewThumb, { backgroundColor: COLOR_SWATCHES.find(sw => sw.label === selectedColor)?.hex || '#F5F0FF' }]}>
              <Text style={styles.previewEmoji}>{getSelectedIcon()}</Text>
            </View>
            <View style={styles.previewInfo}>
              <Text style={styles.previewName}>{itemName.trim() || selectedCategory}</Text>
              <Text style={styles.previewMeta}>
                {selectedSubType ? `${selectedCategory} › ${selectedSubType}` : selectedCategory} · {selectedWearType}{selectedColor ? ` · ${selectedColor}` : ''}
                {selectedFabric ? ` · ${selectedFabric}` : ''}
              </Text>
            </View>
            {selectedColor ? (
              <View style={[styles.previewColorDot, { backgroundColor: COLOR_SWATCHES.find(sw => sw.label === selectedColor)?.hex || '#F5F0FF' }]} />
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
            <Text style={styles.saveBtnText}>{isEditing ? 'UPDATE WARDROBE ITEM' : 'SAVE TO MY WARDROBE'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      </KeyboardSafeView>

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

const styles = themedStyles(() => StyleSheet.create({
  // Horizontal pill sliders: never let the row or the chips stretch tall
  chipSlider: { flexGrow: 0, flexShrink: 0, marginBottom: spacing.sm, marginHorizontal: -spacing.base },
  chipSliderContent: { paddingHorizontal: spacing.base, alignItems: 'center', flexDirection: 'row' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    flexGrow: 0,
    flexShrink: 0,
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  pillSmall: { paddingHorizontal: 11, paddingVertical: 6, gap: 4, borderRadius: 16 },
  pillText: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  groupPillSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipEmojiSmall: { fontSize: 12 },
  pickedText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginTop: 2 },
  swipeHint: { fontSize: 11, color: colors.textMuted, marginBottom: 6 },
  publicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.base,
  },
  publicLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  safe: { flex: 1, backgroundColor: colors.background },
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
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 18, color: colors.textPrimary, lineHeight: 20 },
  headerTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },

  fixedTopSection: {
    paddingHorizontal: spacing.base,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.xs,
  },
  introText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },

  uploadZone: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 16,
    height: 160,
    backgroundColor: colors.divider,
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
    backgroundColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadIcon: { fontSize: 20 },
  uploadTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textPrimary },
  uploadSubtitle: { fontSize: 11, color: colors.textMuted },

  imagePreviewTouch: {
    width: '100%',
    height: '100%',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  aiAnalyzingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 40,
    backgroundColor: 'rgba(24, 18, 51, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 6,
  },
  aiAnalyzingText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: fontWeight.bold,
  },
  aiAnalyzingSubtext: {
    color: '#D1C4E9',
    fontSize: 11,
  },
  aiBadgeContainer: {
    backgroundColor: colors.divider,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  aiBadgeText: {
    color: '#5E35B1',
    fontSize: 12,
    fontWeight: fontWeight.bold,
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
    color: colors.textSecondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: 10,
  },
  sectionLabelError: { color: '#E91E63' },

  groupCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
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
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
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
    color: colors.textPrimary,
  },
  wearTypeTextSelected: {
    color: '#FFFFFF',
  },

  textInputWrap: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  textInput: {
    paddingVertical: 12,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  textInputError: { borderColor: '#F48FB1' },
  errorMsg: { fontSize: 11, color: '#E91E63', fontWeight: fontWeight.semiBold, marginTop: 4 },

  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 6 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2 },
  swatchActive: { borderWidth: 3, borderColor: colors.primary, transform: [{ scale: 1.2 }] },
  colorName: { fontSize: 11, color: colors.textSecondary, fontWeight: fontWeight.semiBold, marginBottom: spacing.sm },

  fabricWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fabricChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  fabricChipActive: { backgroundColor: '#E91E63', borderColor: '#E91E63' },
  fabricChipText: { fontSize: 12, fontWeight: fontWeight.semiBold, color: colors.textSecondary },
  fabricChipTextActive: { color: '#FFFFFF' },

  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    marginTop: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: 'rgba(10,25,64,0.06)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  previewThumb: { width: 50, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  previewEmoji: { fontSize: 26 },
  previewInfo: { flex: 1, marginLeft: 12 },
  previewName: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  previewMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  previewColorDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border },

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
}));
