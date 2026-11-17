import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDemoClient, GUEST_BLOCKED_CODE, GUEST_BLOCKED_MESSAGE } from './demoClient';
import { createSwitchingClient } from './clientSwitch';
import { createFixtures, SAMPLE_IMAGE_BASE, GUEST_USER_ID } from './fixtures';
import { enterGuestMode, exitGuestMode, isGuestMode, subscribeGuestMode } from './guestState';

afterEach(() => exitGuestMode());

function allStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => allStrings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => allStrings(v, out));
  return out;
}

describe('guest state', () => {
  it('is off by default, turns on and off, and tells subscribers', () => {
    let calls = 0;
    const unsubscribe = subscribeGuestMode(() => calls++);
    expect(isGuestMode()).toBe(false);
    enterGuestMode();
    enterGuestMode(); // already on: no second notification
    expect(isGuestMode()).toBe(true);
    exitGuestMode();
    expect(isGuestMode()).toBe(false);
    expect(calls).toBe(2);
    unsubscribe();
  });
});

describe('fixtures contain no real data', () => {
  const data = createFixtures();

  it('marks every account as a sample or the guest', () => {
    for (const p of data.profiles as any[]) {
      expect(p.username === 'guest_demo' || p.username.startsWith('sample')).toBe(true);
      expect(p.id === GUEST_USER_ID || p.id.startsWith('sample-')).toBe(true);
    }
  });

  it('has no email addresses or phone numbers anywhere', () => {
    const text = allStrings(data);
    expect(text.some((s) => /@/.test(s))).toBe(false);
    // Image paths contain folder IDs made of digits; the image test below covers them.
    const prose = text.filter((s) => !/\.(jpg|jpeg|png|webp)$/i.test(s) && !/^https?:\/\//.test(s));
    const withoutDates = prose.map((s) => s.replace(/\d{4}-\d{2}-\d{2}/g, ''));
    expect(withoutDates.some((s) => /\+?\d[\d\s-]{8,}/.test(s))).toBe(false);
  });

  it('only points at the public sample images', () => {
    for (const post of data.posts as any[]) {
      if (post.image_url) expect(post.image_url.startsWith(SAMPLE_IMAGE_BASE)).toBe(true);
    }
    const urls = allStrings(data).filter((s) => /^https?:\/\//.test(s));
    expect(urls.every((u) => u.startsWith(SAMPLE_IMAGE_BASE))).toBe(true);
  });

  it('labels every post, comment, event, residence and offer as a sample', () => {
    for (const post of data.posts as any[]) expect(post.body).toContain('(Sample post)');
    for (const c of data.comments as any[]) expect(c.body).toContain('(Sample comment)');
    for (const e of data.events as any[]) expect(e.description).toContain('(Sample event)');
    for (const r of data.residences as any[]) expect(r.description).toContain('(Sample listing)');
    for (const o of data.offers as any[]) expect(o.description).toContain('(Sample offer)');
  });
});

describe('demo client reads', () => {
  const client = createDemoClient();

  it('filters, orders and limits like the app expects', async () => {
    const { data } = await client.from('posts').select('*').eq('tag', 'Padel').order('created_at', { ascending: false }).limit(5);
    expect(data.length).toBe(1);
    expect(data[0].title).toBe('Padel night this Thursday');
    const newestFirst = await client.from('posts').select('*').order('created_at', { ascending: false });
    const times = newestFirst.data.map((p: any) => p.created_at);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it('resolves the embedded relations the feed asks for', async () => {
    const { data } = await client.from('posts').select('*, author:profiles!posts_author_id_fkey(*), community:communities(name)').order('like_count', { ascending: false }).limit(3);
    expect(data[0].author.username.startsWith('sample')).toBe(true);
    expect(data.some((p: any) => p.community?.name)).toBe(true);
  });

  it('resolves one-to-many embeds, search, in-lists and single rows', async () => {
    const res = await client.from('residences').select('*, room_types(*)').eq('is_active', true);
    expect(res.data[0].room_types.length).toBeGreaterThan(0);
    const search = await client.from('communities').select('*').ilike('name', '%padel%');
    expect(search.data.length).toBe(1);
    const inList = await client.from('posts').select('*').in('id', ['post-gym', 'post-padel']);
    expect(inList.data.length).toBe(2);
    const one = await client.from('posts').select('*').eq('id', 'post-gym').single();
    expect(one.data.title).toContain('gym');
    const none = await client.from('posts').select('*').eq('id', 'missing').maybeSingle();
    expect(none.data).toBeNull();
    expect(none.error).toBeNull();
  });

  it('answers head counts and unknown tables without throwing', async () => {
    const counted = await client.from('posts').select('*', { count: 'exact', head: true });
    expect(counted.count).toBe(8);
    expect((await client.from('no_such_table').select('*')).data).toEqual([]);
  });

  it('serves only upcoming events when asked', async () => {
    const { data } = await client.from('events').select('*').gte('event_date', new Date().toISOString()).order('event_date', { ascending: true }).limit(10);
    expect(data.length).toBeGreaterThan(0);
  });
});

describe('demo client refuses every write', () => {
  function expectBlocked(result: any) {
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe(GUEST_BLOCKED_CODE);
    expect(result.error?.message).toBe(GUEST_BLOCKED_MESSAGE);
  }

  it('blocks insert, update, upsert and delete, including chained calls', async () => {
    const client = createDemoClient();
    expectBlocked(await client.from('posts').insert({ title: 'x' }));
    expectBlocked(await client.from('posts').insert({ title: 'x' }).select().single());
    expectBlocked(await client.from('profiles').update({ bio: 'x' }).eq('id', GUEST_USER_ID));
    expectBlocked(await client.from('follows').upsert({ follower_id: GUEST_USER_ID, following_id: 'sample-maya' }));
    expectBlocked(await client.from('events').delete().eq('id', 'event-padel'));
  });

  it('blocks rpc calls, storage writes, auth writes and edge functions', async () => {
    const client = createDemoClient();
    expectBlocked(await client.rpc('toggle_post_like', { post_id_input: 'post-gym' }));
    expectBlocked(await client.rpc('delete_own_account'));
    expectBlocked(await client.storage.from('post-images').upload('a.jpg', new Blob()));
    expectBlocked(await client.storage.from('post-images').remove(['a.jpg']));
    expectBlocked(await client.auth.signUp({ email: 'a@b.c', password: 'x' }));
    expectBlocked(await client.auth.signInWithPassword({ email: 'a@b.c', password: 'x' }));
    expectBlocked(await client.auth.updateUser({ password: 'x' }));
    expectBlocked(await client.functions.invoke('anything'));
  });

  it('leaves the sample data unchanged after attempted writes', async () => {
    const client = createDemoClient();
    await client.from('posts').insert({ id: 'new', title: 'x' });
    await client.from('posts').delete().neq('id', 'nothing');
    await client.from('profiles').update({ display_name: 'Hacked' });
    const posts = await client.from('posts').select('*');
    expect(posts.data.length).toBe(8);
    expect(posts.data.find((p: any) => p.id === 'new')).toBeUndefined();
    const profiles = await client.from('profiles').select('*');
    expect(profiles.data.some((p: any) => p.display_name === 'Hacked')).toBe(false);
  });

  it('stubs Realtime so screens that subscribe do not break', async () => {
    const client = createDemoClient();
    const channel = client.channel('x').on('postgres_changes', {}, () => {}).subscribe();
    expect(typeof channel.unsubscribe).toBe('function');
    await expect(client.removeChannel(channel)).resolves.toBeDefined();
  });

  it('lets a guest leave the demo through signOut', async () => {
    enterGuestMode();
    await createDemoClient().auth.signOut();
    expect(isGuestMode()).toBe(false);
  });
});

describe('the switch keeps guest mode away from the real client', () => {
  function makeRealClient() {
    const touched: string[] = [];
    const trap = (name: string) => () => { touched.push(name); throw new Error(`real client used: ${name}`); };
    const real = {
      from: trap('from'), rpc: trap('rpc'), channel: trap('channel'), removeChannel: trap('removeChannel'),
      auth: { signOut: trap('auth.signOut'), getSession: trap('auth.getSession') },
      storage: { from: trap('storage.from') },
    };
    return { real, touched };
  }

  it('sends every call to the demo client while guest mode is on', async () => {
    const { real, touched } = makeRealClient();
    const switching: any = createSwitchingClient(real, createDemoClient(), isGuestMode);
    enterGuestMode();
    await switching.from('posts').select('*');
    await switching.from('posts').insert({ title: 'x' });
    await switching.rpc('claim_offer', { offer_id_input: 'offer-1' });
    switching.channel('x').subscribe();
    await switching.auth.getSession();
    switching.storage.from('post-images').getPublicUrl('a.jpg');
    expect(touched).toEqual([]);
  });

  it('goes back to the real client once the demo is left', () => {
    const { real, touched } = makeRealClient();
    const switching: any = createSwitchingClient(real, createDemoClient(), isGuestMode);
    enterGuestMode();
    exitGuestMode();
    expect(() => switching.from('posts')).toThrow('real client used: from');
    expect(touched).toEqual(['from']);
  });
});

describe('the guest folder stays self-contained', () => {
  it('never imports the real Supabase client or storage', () => {
    const dir = __dirname;
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    for (const f of files) {
      const text = readFileSync(path.join(dir, f), 'utf8');
      expect(text, f).not.toMatch(/from ['"]@\/lib\/supabase['"]/);
      expect(text, f).not.toMatch(/createClient\(/);
      expect(text, f).not.toMatch(/\bfetch\(/);
      expect(text, f).not.toMatch(/AsyncStorage|localStorage|sessionStorage|secureStorage/);
    }
  });
});
