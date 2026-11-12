// The app owner: always an admin (all admin rights), on top of users/{uid}.role == 'admin'.
// Keep equal to isOwner() in firestore.rules.
export const OWNER_EMAILS: string[] = ['2saibabug@gmail.com'];

export const isOwnerEmail = (email?: string | null): boolean =>
  !!email && OWNER_EMAILS.includes(email.trim().toLowerCase());
