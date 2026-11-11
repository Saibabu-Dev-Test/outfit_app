// Occasion and Place chips on the Style (AI Stylist) screen. Pure list, no imports, so the offline
// stylist modules and their tests never load Firebase.
export const OCCASIONS = [
  'Work', 'Interview', 'College', 'Date', 'Party', 'Wedding / Function', 'Festival', 'Temple', 'Beach', 'Gym',
  'Travel', 'Casual outing',
];
export const PLACES = [
  'Indoor', 'Outdoor', 'Office', 'College', 'Temple', 'Wedding', 'Party', 'Date', 'Interview', 'Beach',
  'Hill station', 'Gym', 'Travel', 'Home / Night', 'Restaurant',
];
export const ALL_CHIPS: string[] = Array.from(new Set([...OCCASIONS, ...PLACES]));
