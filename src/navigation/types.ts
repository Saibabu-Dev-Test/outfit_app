// Screens pushed over the tabs (full screen, no tab bar)
export type RootStackParamList = {
  Auth: undefined;
  MainApp: { screen?: string; params?: any } | undefined;
  CircleChat: { circleId: string };
  CircleInfo: { circleId: string };
  NewPost: undefined;
  UserProfile: { userId: string };
  UserSearch: undefined;
  // { postId } (old) or { target: CommentTarget }
  Comments: { postId?: string; highlightId?: string; target?: any };
  Admin: undefined;
  Settings: { edit?: boolean } | undefined;
  Achievements: undefined;
  Likes: undefined;
  PostDetail: { kind: 'post' | 'wardrobe'; id: string };
  FollowList: { userId: string; mode: 'followers' | 'following'; name?: string };
};
