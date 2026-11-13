// Space to keep at the bottom of scrollable content, bottom sheets and modals so the last row
// never sits under the Android navigation bar (edge-to-edge) or the iOS home indicator.
// insets.bottom is 0 with gesture navigation off-screen, ~48 dp with the 3-button bar.
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const useBottomSpace = (extra: number = 24): number => useSafeAreaInsets().bottom + extra;
