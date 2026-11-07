// ===== src/config/apiConfig.ts =====
// Add as line 1:
import { Platform } from 'react-native';

// ===== src/screens/Home/HomeScreen.tsx =====
// Line 91:  user.uid  ->  user.id
const voteId = `top_colors_${today}_${user.id}`;
// Line 97:  user.uid  ->  user.id
        userId: user.id,
// In StyleSheet.create({...}), add this style:
  colorRowVoted: {
    backgroundColor: "#FFF0F5",
    borderRadius: 12,
  },

// ===== src/screens/Profile/ProfileScreen.tsx =====
// Line 219:
      console.log("Firebase User Found:", authUser.id);
// Lines 223-226:
        id: authUser.id,
        name: authUser.name || "User",
        avatarUrl: authUser.avatarUrl || null,
// Line 284:
      id: profileData?.id || authUser?.id,
