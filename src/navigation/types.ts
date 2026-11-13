// Screens pushed over the tabs (full screen, no tab bar)
export type RootStackParamList = {
  Auth: undefined;
  MainApp: { screen?: string; params?: any } | undefined;
  CircleChat: { circleId: string; messageId?: string };
  CircleInfo: { circleId: string };
  UserProfile: { userId: string };
  UserSearch: undefined;
  // { postId } (old) or { target: CommentTarget }
  Comments: { postId?: string; highlightId?: string; target?: any };
  Admin: undefined;
  AdminUsers: undefined;
  Settings: { edit?: boolean } | undefined;
  Achievements: undefined;
  Likes: { tab?: 'activity' | 'likes' } | undefined;
  LikedBy: { kind: 'post' | 'wardrobe'; id: string };
  PostDetail: { kind: 'post' | 'wardrobe'; id: string };
  FollowList: { userId: string; mode: 'followers' | 'following'; name?: string };
  // Birthday wishes for one person, or today's "Happy birthday to all" circle
  Rewards: undefined;
  FunctionPlanner: undefined;
  Porutham: undefined;
  WeatherOutfit: undefined;
  AdminRewardRequests: undefined;
  AdminStorage: undefined;
  // Survey wall / offerwall in a WebView (Earn tab)
  EarnWall: { url: string; title?: string; kind?: 'survey' | 'offer' };
  BirthdayChat: { mode: 'wishes'; uid?: string } | { mode: 'circle' };
};
