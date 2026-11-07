// Screens pushed over the tabs (full screen, no tab bar)
export type RootStackParamList = {
  Auth: undefined;
  MainApp: undefined;
  CircleChat: { circleId: string };
  CircleInfo: { circleId: string };
  Feed: { refreshAt?: number } | undefined;
  NewPost: undefined;
  UserProfile: { userId: string };
  UserSearch: undefined;
  Comments: { postId: string; highlightId?: string };
  Admin: undefined;
};
