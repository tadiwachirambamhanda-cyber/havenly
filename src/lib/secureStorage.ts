import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// The keychain warns above 2048 bytes per value (and may start rejecting
// them in a future SDK), but a Supabase session — two tokens plus the user
// object — can be larger than that. Long values are split across several
// keychain entries, with the original key holding just a chunk count.
const CHUNK_BYTES = 1900; // UTF-8 bytes per piece, under the 2048 limit
const CHUNK_MARKER = '__chunks:';

const utf8Length = (codePoint: number) => (codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4);

// Splits on whole characters by their UTF-8 size, not string length: names
// and metadata can contain Arabic or accented text, where one character is
// 2–4 bytes, so a character count alone can still overflow the limit.
function splitByBytes(value: string): string[] {
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of value) {
    const size = utf8Length(char.codePointAt(0) ?? 0);
    if (bytes + size > CHUNK_BYTES) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  if (current) parts.push(current);
  return parts;
}

const chunkKey = (key: string, index: number) => `${key}.${index}`;

async function chunkCount(key: string): Promise<number> {
  const head = await SecureStore.getItemAsync(key);
  return head?.startsWith(CHUNK_MARKER) ? Number(head.slice(CHUNK_MARKER.length)) || 0 : 0;
}

async function removeChunks(key: string, fromIndex: number, toIndex: number): Promise<void> {
  const deletions: Promise<void>[] = [];
  for (let i = fromIndex; i < toIndex; i++) deletions.push(SecureStore.deleteItemAsync(chunkKey(key, i)));
  await Promise.all(deletions);
}

const nativeStorage = {
  async getItem(key: string): Promise<string | null> {
    const head = await SecureStore.getItemAsync(key);
    if (head == null || !head.startsWith(CHUNK_MARKER)) return head;
    const count = Number(head.slice(CHUNK_MARKER.length)) || 0;
    const parts = await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i))));
    // A missing piece means a half-finished write; treat it as no session
    // rather than handing back corrupted JSON.
    return parts.some((p) => p == null) ? null : parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    const previousCount = await chunkCount(key);
    const parts = splitByBytes(value);
    if (parts.length <= 1) {
      await SecureStore.setItemAsync(key, value);
      await removeChunks(key, 0, previousCount);
      return;
    }
    // Pieces first, then the count that points at them, so a crash mid-write
    // never leaves the head pointing at pieces that don't exist yet.
    await Promise.all(parts.map((part, i) => SecureStore.setItemAsync(chunkKey(key, i), part)));
    await SecureStore.setItemAsync(key, `${CHUNK_MARKER}${parts.length}`);
    await removeChunks(key, parts.length, previousCount);
  },
  async removeItem(key: string): Promise<void> {
    const count = await chunkCount(key);
    await SecureStore.deleteItemAsync(key);
    await removeChunks(key, 0, count);
  },
};

// Keeps the Supabase session (access + refresh tokens) in the device's
// encrypted keychain instead of plain AsyncStorage. Web has no keychain
// equivalent, so it falls back to AsyncStorage there — same as Supabase's
// own React Native guide recommends.
export const secureStorage = Platform.OS === 'web' ? AsyncStorage : nativeStorage;
