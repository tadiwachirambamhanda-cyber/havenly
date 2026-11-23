import { supabase } from '@/lib/supabase';
import type { GroupStatus } from './groupEnquiry';
import type { Residence } from '@/types';

// Database calls for group enquiries. Every write goes through a database function that checks the rules
// (see supabase/migrations/20261123100000_group_enquiry.sql); phone numbers are never readable by students.

export interface GroupMember { user_id: string; joined_at: string; display_name: string; university: string | null }

export interface GroupView {
  id: string; organiser_id: string; residence_id: string; invite_code: string; status: GroupStatus;
  residence: Residence | null; members: GroupMember[];
}

export interface GroupPreview {
  group_id: string; residence_id: string; residence_name: string; organiser_name: string; members: number; status: GroupStatus;
}

export interface MyGroupRow { id: string; status: GroupStatus; residence_name: string; members: number }

export async function createGroup(residenceId: string, phone: string): Promise<{ group_id: string; invite_code: string }> {
  const { data, error } = await supabase.rpc('create_enquiry_group', { p_residence: residenceId, p_phone: phone.trim() });
  if (error) throw error;
  const row = (data as { group_id: string; invite_code: string }[] | null)?.[0];
  if (!row) throw new Error('No group was created.');
  return row;
}

export async function previewGroup(code: string): Promise<GroupPreview | null> {
  const { data, error } = await supabase.rpc('enquiry_group_preview', { p_code: code });
  if (error) throw error;
  return ((data as GroupPreview[] | null) ?? [])[0] ?? null;
}

export async function joinGroup(code: string, phone: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_enquiry_group', { p_code: code, p_phone: phone.trim() });
  if (error) throw error;
  return data as string;
}

export async function leaveGroup(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_enquiry_group', { p_group: groupId });
  if (error) throw error;
}

export async function fetchGroup(groupId: string): Promise<GroupView | null> {
  const { data, error } = await supabase.from('enquiry_groups')
    .select('id, organiser_id, residence_id, invite_code, status, residence:residences(*, room_types(*)), members:enquiry_group_members(user_id, joined_at, profile:profiles(display_name, university))')
    .eq('id', groupId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as Omit<GroupView, 'members'> & {
    members: { user_id: string; joined_at: string; profile: { display_name: string; university: string | null } | null }[];
  };
  return {
    ...row,
    members: [...row.members]
      .sort((a, b) => (a.user_id === row.organiser_id ? -1 : b.user_id === row.organiser_id ? 1 : a.joined_at.localeCompare(b.joined_at)))
      .map((m) => ({ user_id: m.user_id, joined_at: m.joined_at, display_name: m.profile?.display_name ?? 'Student', university: m.profile?.university ?? null })),
  };
}

// The groups this student is in that are still worth showing (open, or sent and waiting for the team).
export async function fetchMyGroups(userId: string): Promise<MyGroupRow[]> {
  const { data, error } = await supabase.from('enquiry_group_members')
    .select('group:enquiry_groups(id, status, residence:residences(name), members:enquiry_group_members(user_id))')
    .eq('user_id', userId);
  if (error) throw error;
  type Row = { group: { id: string; status: GroupStatus; residence: { name: string } | null; members: { user_id: string }[] } | null };
  return ((data as unknown as Row[]) ?? [])
    .map((r) => r.group)
    .filter((g): g is NonNullable<Row['group']> => !!g && g.status !== 'closed')
    .map((g) => ({ id: g.id, status: g.status, residence_name: g.residence?.name ?? 'A home', members: g.members.length }));
}

export async function myGroupIds(userId: string): Promise<string[]> {
  const { data } = await supabase.from('enquiry_group_members').select('group_id').eq('user_id', userId);
  return ((data as { group_id: string }[] | null) ?? []).map((r) => r.group_id);
}

export interface AdminGroupMember { user_id: string; display_name: string; university: string | null; contact_phone: string; is_organiser: boolean }

export async function adminEnquiryGroup(enquiryId: string): Promise<AdminGroupMember[]> {
  const { data, error } = await supabase.rpc('admin_enquiry_group', { p_enquiry: enquiryId });
  if (error) throw error;
  return (data as AdminGroupMember[]) ?? [];
}

// The phone number from this student's latest enquiry, so a group does not ask for it again.
export async function lastEnquiryPhone(userId: string): Promise<string> {
  const { data } = await supabase.from('housing_enquiries').select('contact_phone').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(1);
  return ((data as { contact_phone: string | null }[] | null) ?? [])[0]?.contact_phone ?? '';
}
