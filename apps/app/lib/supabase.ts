import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import type { Database } from '@plano-da-ju/supabase';

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://187.77.43.98:8000';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc2ODE1Njk5LCJleHAiOjE5MzQ0OTU2OTl9.f1ZEGlDkYH-qvifujITaMqjEMXUDDDk9HF-nl3ne2NI';

/**
 * Platform-aware auth storage adapter.
 * - Native (iOS/Android): expo-secure-store (encrypted, persistent)
 * - Web: localStorage (SSR-safe: no-ops on server, real storage on client)
 */
function buildStorageAdapter() {
  if (Platform.OS !== 'web') {
    // Lazy import so expo-secure-store is never evaluated in Node.js SSR context
    const SecureStore = require('expo-secure-store');
    return {
      getItem: (key: string) => SecureStore.getItemAsync(key),
      setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
      removeItem: (key: string) => SecureStore.deleteItemAsync(key),
    };
  }

  // Web / SSR: guard localStorage access — in Node SSR context localStorage may
  // exist as a stub but getItem may not be a real function.
  function isLocalStorageAvailable() {
    return (
      typeof localStorage !== 'undefined' &&
      typeof localStorage?.getItem === 'function'
    );
  }

  return {
    getItem: (key: string): string | null => {
      if (!isLocalStorageAvailable()) return null;
      return localStorage.getItem(key);
    },
    setItem: (key: string, value: string): void => {
      if (!isLocalStorageAvailable()) return;
      localStorage.setItem(key, value);
    },
    removeItem: (key: string): void => {
      if (!isLocalStorageAvailable()) return;
      localStorage.removeItem(key);
    },
  };
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: buildStorageAdapter(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
