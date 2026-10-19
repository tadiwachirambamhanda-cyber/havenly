import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl ?? '';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey ?? '';

// supabase-js's own storage.upload() has no progress callback — it's a
// plain fetch() under the hood. Hitting the Storage REST endpoint directly
// with XMLHttpRequest (which does expose upload progress) gets a real
// percentage instead of just a static "Uploading…" label.
export async function uploadWithProgress(
  bucket: string,
  path: string,
  body: ArrayBuffer,
  contentType: string,
  onProgress: (fraction: number) => void
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${supabaseUrl}/storage/v1/object/${bucket}/${path}`);
    xhr.setRequestHeader('apikey', supabaseAnonKey);
    if (session?.access_token) xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.setRequestHeader('cache-control', 'max-age=3600');
    xhr.setRequestHeader('x-upsert', 'false');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection.'));
    xhr.send(body);
  });
}
