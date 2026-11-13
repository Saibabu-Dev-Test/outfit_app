// Photo storage chain (FREE tiers only, nothing that needs a card or payment).
//
// Today every photo is saved INSIDE Firestore documents as compressed base64 (the Firebase Spark
// plan has no Cloud Storage), so "Firebase" here means Firestore's 1 GiB free storage, shared with
// all other app data. New uploads go to the FIRST provider in CHAIN that is configured and below
// SWITCH_AT of its free limit; when it fills up (or says "quota exceeded") the next one takes over.
// Photos already saved are NEVER moved or deleted when the chain switches: every doc keeps the full
// URL + provider name it was saved with (storageProvider / photoUrl), so old photos keep loading.
//
// Only PUBLIC values go here (cloud names, unsigned presets, anon keys meant for apps). Providers
// whose uploads need a secret key or a signing server are listed as 'needs setup' and skipped.
// Usage is counted in Firestore stats/storage/providers/{id} (bytesUsed, fileCount, lastUpload)
// and shown in Admin > Storage.

export type MediaType = 'image' | 'video';

export type ProviderId =
  | 'firebase'
  | 'cloudinary'
  | 'supabase'
  | 'backblaze'
  | 'tigris'
  | 'imagekit'
  | 'appwrite'
  | 'imgbb';

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  media: MediaType[]; // what it may store (videos are NOT enabled in the app yet)
  freeBytes: number; // free-tier storage limit
  freeNote: string; // what the free tier is, for the Admin screen
  // Upload is possible from the app with public config only (no secret, no server)
  clientUpload: boolean;
  // Public values; a provider is "configured" when every required one is filled
  config: Record<string, string>;
  required: string[];
  setupNote: string; // what the owner must do to enable it
}

const GB = 1024 * 1024 * 1024;

// Switch to the next provider at 95% of the free limit, so no provider ever bills
export const SWITCH_AT = 0.95;

export const CHAIN: ProviderConfig[] = [
  {
    id: 'firebase',
    name: 'Firebase (Firestore, current)',
    media: ['image'],
    freeBytes: 1 * GB,
    freeNote: 'Spark plan: 1 GiB Firestore storage (shared with all app data)',
    clientUpload: true,
    config: { project: 'outfit-vote-9edca' },
    required: ['project'],
    setupNote: 'Built in.',
  },
  {
    id: 'cloudinary',
    name: 'Cloudinary',
    media: ['image', 'video'],
    freeBytes: 25 * GB, // free plan: 25 monthly credits (1 credit = 1 GB storage or 1 GB bandwidth)
    freeNote: 'Free plan: 25 credits/month (1 credit = 1 GB storage or bandwidth)',
    clientUpload: true,
    config: { cloudName: 'outfitvote', uploadPreset: 'outfit_unsigned', folder: 'outfit' },
    required: ['cloudName', 'uploadPreset'],
    setupNote: 'Unsigned upload preset (no API secret in the app).',
  },
  {
    id: 'supabase',
    name: 'Supabase Storage',
    media: ['image', 'video'],
    freeBytes: 1 * GB,
    freeNote: 'Free plan: 1 GB file storage',
    clientUpload: true,
    // TODO(storage): fill after creating a free Supabase project (signup currently blocked)
    config: { url: '', anonKey: '', bucket: 'outfit-photos' },
    required: ['url', 'anonKey', 'bucket'],
    setupNote: 'Project URL + anon public key + a public bucket "outfit-photos" with an INSERT policy for anon.',
  },
  {
    id: 'backblaze',
    name: 'Backblaze B2',
    media: ['image', 'video'],
    freeBytes: 10 * GB,
    freeNote: 'First 10 GB free',
    clientUpload: false,
    config: {},
    required: ['uploadEndpoint'],
    setupNote: 'Needs setup: uploads need a short-lived auth token from a server (the app key is secret).',
  },
  {
    id: 'tigris',
    name: 'Tigris',
    media: ['image', 'video'],
    freeBytes: 5 * GB,
    freeNote: 'Free tier: 5 GB',
    clientUpload: false,
    config: {},
    required: ['uploadEndpoint'],
    setupNote: 'Needs setup: S3 uploads need presigned URLs from a server (access keys are secret).',
  },
  {
    id: 'imagekit',
    name: 'ImageKit',
    media: ['image', 'video'],
    freeBytes: 3 * GB,
    freeNote: 'Free plan: 3 GB storage',
    clientUpload: false,
    config: {},
    required: ['authEndpoint'],
    setupNote: 'Needs setup: client uploads need a signature from a server (private key is secret).',
  },
  {
    id: 'appwrite',
    name: 'Appwrite Storage',
    media: ['image', 'video'],
    freeBytes: 2 * GB,
    freeNote: 'Free plan: 2 GB storage',
    clientUpload: true,
    // TODO(storage): fill after creating a free Appwrite Cloud project
    config: { endpoint: 'https://cloud.appwrite.io/v1', projectId: '', bucketId: '' },
    required: ['endpoint', 'projectId', 'bucketId'],
    setupNote: 'Project ID + a bucket with Create and Read permission for "Any".',
  },
  {
    id: 'imgbb',
    name: 'ImgBB',
    media: ['image'],
    freeBytes: 10 * GB, // no published total limit (32 MB per image); counted as 10 GB to stay careful
    freeNote: 'Free: no published total limit (32 MB per image); counted as 10 GB',
    clientUpload: true,
    // TODO(storage): free API key from api.imgbb.com (it only allows uploading to this account)
    config: { apiKey: '' },
    required: ['apiKey'],
    setupNote: 'Free API key from api.imgbb.com (last resort).',
  },
];

export const isConfigured = (p: ProviderConfig) => p.clientUpload && p.required.every(k => !!(p.config[k] || '').trim());
export const totalFreeBytes = (media: MediaType = 'image') =>
  CHAIN.filter(p => isConfigured(p) && p.media.includes(media)).reduce((n, p) => n + p.freeBytes, 0);

// Video uploads are not enabled in the app yet (the chain is ready for them)
export const VIDEO_UPLOADS_ENABLED = false;
