// An in-memory stand-in for the Supabase client, used only in guest mode. It
// answers reads from the sample fixtures and refuses every write. It never makes
// a network request.
import { createFixtures, GUEST_GROUP_CODE, GUEST_GROUP_PREVIEW, GUEST_HOUSEMATE_CARDS, type FixtureTables } from './fixtures';
import { exitGuestMode, notifyGuestBlocked } from './guestState';

export const GUEST_BLOCKED_MESSAGE = 'Create an account to do this.';
export const GUEST_BLOCKED_CODE = 'GUEST_READ_ONLY';

type Row = Record<string, any>;

// `quiet` is for calls the app makes by itself on load (the streak counter): they
// are still refused, but they must not flash the banner at a visitor who has not
// tried anything yet.
function blockedResult(quiet = false) {
  if (!quiet) notifyGuestBlocked();
  return { data: null, count: null, status: 403, statusText: 'Forbidden', error: { message: GUEST_BLOCKED_MESSAGE, code: GUEST_BLOCKED_CODE, details: '', hint: '' } };
}

// Embedded relations the app asks for in `select('*, alias:table!fk(*)')`.
// Anything not listed resolves to null (one) or an empty list (many).
const RELATIONS: Record<string, { table: string; fk: string; many?: boolean }> = {
  'posts.author': { table: 'profiles', fk: 'author_id' },
  'posts.community': { table: 'communities', fk: 'community_id' },
  'comments.author': { table: 'profiles', fk: 'author_id' },
  'residences.room_types': { table: 'room_types', fk: 'residence_id', many: true },
  'community_members.community': { table: 'communities', fk: 'community_id' },
  'interests.user': { table: 'profiles', fk: 'user_id' },
  'check_ins.user': { table: 'profiles', fk: 'user_id' },
  'offers.brand': { table: 'brands', fk: 'brand_id' },
  'notifications.actor': { table: 'profiles', fk: 'actor_id' },
  'notifications.residence': { table: 'residences', fk: 'residence_id' },
  'housing_enquiries.user': { table: 'profiles', fk: 'user_id' },
  'housing_enquiries.residence': { table: 'residences', fk: 'residence_id' },
};

function parseEmbeds(select: string): { alias: string }[] {
  const out: { alias: string }[] = [];
  const re = /(?:(\w+):)?(\w+)(?:![\w]+)?\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(select)) !== null) out.push({ alias: m[1] ?? m[2] });
  return out;
}

function likeToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

function compare(a: any, b: any): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

type Predicate = (row: Row) => boolean;

function conditionFromOr(part: string): Predicate | null {
  const bits = part.split('.');
  if (bits.length < 3) return null;
  const col = bits[0];
  const op = bits[1];
  const val = bits.slice(2).join('.');
  if (op === 'eq') return (r) => String(r[col]) === val;
  if (op === 'neq') return (r) => String(r[col]) !== val;
  if (op === 'ilike') return (r) => likeToRegExp(val).test(String(r[col] ?? ''));
  if (op === 'is') return (r) => (val === 'null' ? r[col] == null : String(r[col]) === val);
  return null;
}

class Query implements PromiseLike<any> {
  private filters: Predicate[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private limitN: number | null = null;
  private from_: number | null = null;
  private to_: number | null = null;
  private selectStr = '*';
  private headOnly = false;
  private wantCount = false;
  private mode: 'many' | 'single' | 'maybe' = 'many';
  private blocked = false;

  constructor(private table: string, private data: FixtureTables) {}

  // Writes: remembered as blocked. The chain keeps working so call sites like
  // `.insert(...).select().single()` still resolve, to the blocked error.
  insert() { this.blocked = true; return this; }
  update() { this.blocked = true; return this; }
  upsert() { this.blocked = true; return this; }
  delete() { this.blocked = true; return this; }

  select(columns = '*', options?: { count?: string; head?: boolean }) {
    this.selectStr = columns;
    if (options?.head) this.headOnly = true;
    if (options?.count) this.wantCount = true;
    return this;
  }

  eq(col: string, val: any) { this.filters.push((r) => r[col] === val); return this; }
  neq(col: string, val: any) { this.filters.push((r) => r[col] !== val); return this; }
  gt(col: string, val: any) { this.filters.push((r) => compare(r[col], val) > 0); return this; }
  gte(col: string, val: any) { this.filters.push((r) => compare(r[col], val) >= 0); return this; }
  lt(col: string, val: any) { this.filters.push((r) => compare(r[col], val) < 0); return this; }
  lte(col: string, val: any) { this.filters.push((r) => compare(r[col], val) <= 0); return this; }
  in(col: string, vals: any[]) { this.filters.push((r) => vals.includes(r[col])); return this; }
  is(col: string, val: any) { this.filters.push((r) => (val === null ? r[col] == null : r[col] === val)); return this; }
  like(col: string, pattern: string) { this.filters.push((r) => likeToRegExp(pattern).test(String(r[col] ?? ''))); return this; }
  ilike(col: string, pattern: string) { return this.like(col, pattern); }
  contains(col: string, vals: any) {
    this.filters.push((r) => Array.isArray(r[col]) && (Array.isArray(vals) ? vals : [vals]).every((v: any) => r[col].includes(v)));
    return this;
  }
  overlaps(col: string, vals: any[]) { this.filters.push((r) => Array.isArray(r[col]) && vals.some((v) => r[col].includes(v))); return this; }
  or(expr: string) {
    const preds = expr.split(',').map(conditionFromOr).filter((p): p is Predicate => !!p);
    if (preds.length) this.filters.push((r) => preds.some((p) => p(r)));
    return this;
  }
  not(col: string, op: string, val: any) {
    if (op === 'is') this.filters.push((r) => (val === null ? r[col] != null : r[col] !== val));
    else if (op === 'eq') this.filters.push((r) => r[col] !== val);
    else if (op === 'in') this.filters.push((r) => !String(val).replace(/[()]/g, '').split(',').includes(String(r[col])));
    return this;
  }
  match(obj: Row) { Object.entries(obj).forEach(([k, v]) => this.eq(k, v)); return this; }
  filter() { return this; }
  textSearch() { return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.orders.push({ col, asc: opts?.ascending !== false }); return this; }
  limit(n: number) { this.limitN = n; return this; }
  range(a: number, b: number) { this.from_ = a; this.to_ = b; return this; }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }
  abortSignal() { return this; }

  private resolveEmbeds(row: Row): Row {
    const out: Row = { ...row };
    for (const { alias } of parseEmbeds(this.selectStr)) {
      const rel = RELATIONS[`${this.table}.${alias}`];
      if (!rel) { out[alias] = null; continue; }
      const target = this.data[rel.table] ?? [];
      if (rel.many) out[alias] = target.filter((t) => t[rel.fk] === row.id);
      else out[alias] = target.find((t) => t.id === row[rel.fk]) ?? null;
    }
    return out;
  }

  private run() {
    if (this.blocked) return blockedResult();
    let rows = (this.data[this.table] ?? []).filter((r) => this.filters.every((f) => f(r)));
    for (const { col, asc } of [...this.orders].reverse()) {
      rows = [...rows].sort((a, b) => (asc ? 1 : -1) * compare(a[col], b[col]));
    }
    const total = rows.length;
    if (this.from_ != null && this.to_ != null) rows = rows.slice(this.from_, this.to_ + 1);
    if (this.limitN != null) rows = rows.slice(0, this.limitN);
    const count = this.wantCount ? total : null;
    if (this.headOnly) return { data: null, count, error: null, status: 200, statusText: 'OK' };
    const shaped = rows.map((r) => this.resolveEmbeds(r));
    if (this.mode === 'single') {
      return shaped.length === 1
        ? { data: shaped[0], count, error: null, status: 200, statusText: 'OK' }
        : { data: null, count, status: 406, statusText: 'Not Acceptable', error: { message: 'No single row found', code: 'PGRST116', details: '', hint: '' } };
    }
    if (this.mode === 'maybe') return { data: shaped[0] ?? null, count, error: null, status: 200, statusText: 'OK' };
    return { data: shaped, count, error: null, status: 200, statusText: 'OK' };
  }

  then<R1 = any, R2 = never>(onfulfilled?: ((value: any) => R1 | PromiseLike<R1>) | null, onrejected?: ((reason: any) => R2 | PromiseLike<R2>) | null): PromiseLike<R1 | R2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

function channelStub(): any {
  const stub: any = {
    on: () => stub,
    subscribe: () => stub,
    unsubscribe: () => Promise.resolve('ok'),
    send: () => Promise.resolve('ok'),
  };
  return stub;
}

export function createDemoClient(data: FixtureTables = createFixtures()): any {
  const blocked = () => Promise.resolve(blockedResult());
  return {
    from: (table: string) => new Query(table, data),
    rpc: (name: string, args?: { p_code?: string }) => {
      if (name === 'bump_streak') return Promise.resolve(blockedResult(true));
      // Reads for the housemate board are answered with sample cards; every write stays blocked.
      if (name === 'housemate_board') return Promise.resolve({ data: GUEST_HOUSEMATE_CARDS, error: null });
      if (name === 'housemates_for_home') return Promise.resolve({ data: 1, error: null });
      if (name === 'enquiry_group_preview') {
        return Promise.resolve({ data: (args?.p_code ?? '').toUpperCase() === GUEST_GROUP_CODE ? [GUEST_GROUP_PREVIEW] : [], error: null });
      }
      return blocked();
    },
    channel: () => channelStub(),
    removeChannel: () => Promise.resolve('ok'),
    removeAllChannels: () => Promise.resolve([]),
    getChannels: () => [],
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      // Leaving the demo is the one "auth" action a guest may take.
      signOut: () => { exitGuestMode(); return Promise.resolve({ error: null }); },
      signInWithPassword: blocked,
      signUp: blocked,
      resetPasswordForEmail: blocked,
      updateUser: blocked,
      refreshSession: blocked,
      setSession: blocked,
      signInWithOAuth: blocked,
      signInWithOtp: blocked,
      verifyOtp: blocked,
    },
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({ data: { publicUrl: path } }),
        createSignedUrl: blocked,
        createSignedUrls: blocked,
        upload: blocked,
        update: blocked,
        remove: blocked,
        move: blocked,
        copy: blocked,
        list: () => Promise.resolve({ data: [], error: null }),
        download: blocked,
      }),
    },
    functions: { invoke: blocked },
  };
}
