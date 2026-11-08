// AI stylist config. The key comes from ai.generated.ts (written by CI from the
// GEMINI_API_KEY GitHub secret). Empty key = "AI stylist is coming soon".
import { GEMINI_API_KEY as GENERATED_KEY } from './ai.generated';

export const GEMINI_API_KEY: string = (GENERATED_KEY || '').trim();

// Free-tier flash models, tried in order (gemini-2.0-flash was shut down on 2026-06-01)
export const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest'];

export const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

// Messages per user per day
export const AI_DAILY_LIMIT = 20;

export const isAiConfigured = (): boolean => GEMINI_API_KEY.length > 0;
