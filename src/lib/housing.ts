import type { IconName } from '@/components/Icon';
import { supabase } from '@/lib/supabase';
import type { BillingPeriod, EnquiryStatus, GenderPolicy, Residence, RoomType } from '@/types';

export const PERIOD_LABEL: Record<BillingPeriod, string> = { year: 'year', semester: 'semester', month: 'month' };

export const GENDER_POLICY_LABEL: Record<GenderPolicy, string> = {
  mixed: 'Mixed',
  female_only: 'Female only',
  male_only: 'Male only',
};

export const ENQUIRY_STATUS_LABEL: Record<EnquiryStatus, string> = {
  new: 'Sent',
  contacted: 'Residence in touch',
  viewing_booked: 'Viewing booked',
  signed: 'Signed',
  lost: 'Closed',
};

// The team sees the pipeline in its own words; a student sees friendlier
// ones (ENQUIRY_STATUS_LABEL) — "lost" isn't something to show a student.
export const ADMIN_STATUS_LABEL: Record<EnquiryStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  viewing_booked: 'Viewing booked',
  signed: 'Signed',
  lost: 'Lost',
};

export const ENQUIRY_STATUSES: EnquiryStatus[] = ['new', 'contacted', 'viewing_booked', 'signed', 'lost'];

export const AMENITIES: { key: string; icon: IconName }[] = [
  { key: 'Furnished', icon: 'couch' },
  { key: 'Bills included', icon: 'zap' },
  { key: 'Wi-Fi', icon: 'wifi' },
  { key: 'Campus shuttle', icon: 'bus' },
  { key: 'Gym', icon: 'barbell' },
  { key: 'Pool', icon: 'swimming-pool' },
  { key: 'Study rooms', icon: 'book-open' },
  { key: 'Laundry', icon: 'washing-machine' },
  { key: 'Cleaning', icon: 'broom' },
  { key: '24/7 security', icon: 'shield-check' },
  { key: 'Shared kitchen', icon: 'cooking-pot' },
  { key: 'Parking', icon: 'car' },
];

export function amenityIcon(key: string): IconName {
  return AMENITIES.find((a) => a.key === key)?.icon ?? 'check';
}

export function formatAed(amount: number): string {
  return `AED ${Math.round(amount).toLocaleString('en-US')}`;
}

// Prices are listed per year, semester or month depending on the
// residence, so compare and filter on a yearly figure.
export function annualPrice(room: Pick<RoomType, 'price_aed' | 'billing_period'>): number {
  if (room.billing_period === 'month') return room.price_aed * 12;
  if (room.billing_period === 'semester') return room.price_aed * 2;
  return room.price_aed;
}

export function cheapestRoom(residence: Residence): RoomType | null {
  const rooms = (residence.room_types ?? []).filter((r) => r.is_available);
  if (!rooms.length) return null;
  return rooms.reduce((min, r) => (annualPrice(r) < annualPrice(min) ? r : min));
}

// "2026-09-01" -> "September 2026"
export function formatMonth(isoDate: string): string {
  const [y, m] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// The next `count` months starting with the current one, as first-of-month
// ISO dates — what a student picks as their move-in.
export function upcomingMonths(count: number): string[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
}

export async function setResidenceSaved(userId: string, residenceId: string, saved: boolean): Promise<void> {
  const { error } = saved
    ? await supabase.from('saved_residences').insert({ user_id: userId, residence_id: residenceId })
    : await supabase.from('saved_residences').delete().eq('user_id', userId).eq('residence_id', residenceId);
  if (error) throw error;
}

export async function uploadResidencePhoto(localUri: string): Promise<string> {
  const ext = localUri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
  const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext) ? ext : 'jpg';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
  const arrayBuffer = await fetch(localUri).then((r) => r.arrayBuffer());
  const { error } = await supabase.storage.from('residence-photos').upload(path, arrayBuffer, {
    contentType: `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}`,
  });
  if (error) throw error;
  return supabase.storage.from('residence-photos').getPublicUrl(path).data.publicUrl;
}
