// Turn Firestore errors into messages the user can act on
export const firestoreErrorMessage = (error: any, action: string): string => {
  const code: string = error?.code || '';
  if (code === 'permission-denied') {
    return `${action} failed (permission-denied). Firestore security rules are blocking this. Update the rules in Firebase Console > Firestore > Rules.`;
  }
  if (code === 'unavailable') {
    return `${action} failed: you seem to be offline. Please check your internet.`;
  }
  if (code === 'invalid-argument' || code === 'resource-exhausted') {
    return `${action} failed (${code}). The photo may be too large; please pick a smaller photo.`;
  }
  return `${action} failed${code ? ` (${code})` : ''}: ${error?.message || 'Unknown error'}`;
};
