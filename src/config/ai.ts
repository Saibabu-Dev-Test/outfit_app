// AI stylist config. The key comes from ai.generated.ts (written by CI from the
// GEMINI_API_KEY GitHub secret). Empty key = "AI stylist is coming soon".
import { GEMINI_API_KEY as GENERATED_KEY } from './ai.generated';

export const GEMINI_API_KEY: string = String(GENERATED_KEY || '').trim();

// Free-tier text models from https://ai.google.dev/gemini-api/docs/models (checked Nov 2026),
// tried in order. On 404 / model-not-found / per-model quota the next one is tried.
//  - gemini-3.6-flash: stable Flash, free tier, balanced (fast enough for chat)
//  - gemini-3.5-flash-lite: stable, fastest and cheapest, free tier
//  - gemini-3.8-flash: newest Flash, free tier, uses more thinking tokens
//  - gemini-flash-latest: alias that always points at the current Flash release
//  - gemini-3.1-flash-lite: stable, shutdown date May 7, 2027 (deprecations page)
// gemini-2.0-flash was shut down on 2026-06-01 and gemini-2.5-flash is limited to existing users.
export const GEMINI_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
];

// REST: POST {endpoint}/{model}:generateContent with the key in the x-goog-api-key header
export const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

// Only set this to true when the key is restricted to "Android apps" in Google Cloud
// (package com.saibabu.outfit + the release SHA-1 below). Then the Android app sends the
// X-Android-Package / X-Android-Cert headers. Off by default: a wrong header makes Google
// reject the request, and the web build never sends them.
export const GEMINI_ANDROID_RESTRICTED = false;
export const GEMINI_ANDROID_PACKAGE = 'com.saibabu.outfit';
export const GEMINI_ANDROID_CERT_SHA1 = 'BF31F529A0BC08AD6E94EDF98B35B57FFF905173';

// Messages per user per day
export const AI_DAILY_LIMIT = 20;

export const isAiConfigured = (): boolean => GEMINI_API_KEY.length > 0;
