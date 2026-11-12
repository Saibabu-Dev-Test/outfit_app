// Screens pushed over the tabs (full screen, no tab bar)
export type RootStackParamList = {
  Auth: undefined;
  MainApp: { screen?: string; params?: any } | undefined;
  CircleChat: { circleId: string };
  CircleInfo: { circleId: string };
  UserProfile: { userId: string };
  UserSearch: undefined;
  // { postId } (old) or { target: CommentTarget }
  Comments: { postId?: string; highlightId?: string; target?: any };
  Admin: undefined;
  AdminUsers: undefined;
  Terms: undefined;
  Settings: { edit?: boolean } | undefined;
  Achievements: undefined;
  FunctionPlanner: undefined;
  MonthlyTasks: undefined;
  AdminRewards: undefined;
  Likes: { tab?: 'activity' | 'likes' } | undefined;
  LikedBy: { kind: 'post' | 'wardrobe'; id: string };
  PostDetail: { kind: 'post' | 'wardrobe'; id: string };
  FollowList: { userId: string; mode: 'followers' | 'following'; name?: string };
  // Birthday wishes for one person, or today's "Happy birthday to all" circle
  // 💑 Pelli Porutham: self = the signed-in user's birth details (from Me)
  Porutham: { self?: { name?: string | null; dob?: string | null; timeOfBirth?: string | null; placeOfBirth?: string | null; rashi?: string | null; gender?: string | null } } | undefined;
  BirthdayChat: { mode: 'wishes'; uid?: string } | { mode: 'circle' };
};
