// An in-memory stand-in for the part of the firebase-admin Firestore API the bot uses:
// collections and sub-collections, get/set(merge)/update(dotted paths)/delete/create/add,
// where/orderBy/limit/count, onSnapshot on documents and queries, batches,
// transactions and getAll. Enough to run FirestoreStore and the inhouse half against
// it; not a general emulator. Hand it to code as `fake.asFirestore()`.

import type { Firestore } from 'firebase-admin/firestore';

type Data = Record<string, unknown>;
type Op = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'not-in' | 'array-contains' | 'array-contains-any';

const clone = <T>(v: T): T => structuredClone(v);
let autoId = 0;

function getField(data: Data, path: string): unknown {
    let cur: unknown = data;
    for (const part of path.split('.')) {
        if (cur === null || typeof cur !== 'object') return undefined;
        cur = (cur as Data)[part];
    }
    return cur;
}

function setField(data: Data, path: string, value: unknown): void {
    const parts = path.split('.');
    let cur = data;
    for (const part of parts.slice(0, -1)) {
        if (cur[part] === null || typeof cur[part] !== 'object') cur[part] = {};
        cur = cur[part] as Data;
    }
    cur[parts[parts.length - 1]] = value;
}

function stripUndefined(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stripUndefined);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, stripUndefined(v)]));
    }
    return value;
}

function deepMerge(target: Data, source: Data): Data {
    const out: Data = { ...target };
    for (const [k, v] of Object.entries(source)) {
        out[k] = v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])
            ? deepMerge(out[k] as Data, v as Data)
            : v;
    }
    return out;
}

function compare(a: unknown, b: unknown): number {
    if (a === b) return 0;
    if (a === undefined || a === null) return -1;
    if (b === undefined || b === null) return 1;
    return (a as number) < (b as number) ? -1 : 1;
}

function matches(value: unknown, op: Op, expected: unknown): boolean {
    switch (op) {
        case '==': return JSON.stringify(value) === JSON.stringify(expected);
        case '!=': return value !== undefined && JSON.stringify(value) !== JSON.stringify(expected);
        case '<': return value !== undefined && compare(value, expected) < 0;
        case '<=': return value !== undefined && compare(value, expected) <= 0;
        case '>': return value !== undefined && compare(value, expected) > 0;
        case '>=': return value !== undefined && compare(value, expected) >= 0;
        case 'in': return (expected as unknown[]).some((e) => JSON.stringify(e) === JSON.stringify(value));
        case 'not-in': return value !== undefined && !(expected as unknown[]).some((e) => JSON.stringify(e) === JSON.stringify(value));
        case 'array-contains': return Array.isArray(value) && value.some((v) => JSON.stringify(v) === JSON.stringify(expected));
        case 'array-contains-any': return Array.isArray(value) && value.some((v) => (expected as unknown[]).some((e) => JSON.stringify(e) === JSON.stringify(v)));
    }
}

class FakeDocSnapshot {
    constructor(readonly ref: FakeDocRef, private readonly value: Data | undefined) {}
    get id(): string { return this.ref.id; }
    get exists(): boolean { return this.value !== undefined; }
    data(): Data | undefined { return this.value === undefined ? undefined : clone(this.value); }
    get(field: string): unknown { return this.value === undefined ? undefined : clone(getField(this.value, field)); }
}

class FakeQuerySnapshot {
    constructor(readonly docs: FakeDocSnapshot[]) {}
    get empty(): boolean { return this.docs.length === 0; }
    get size(): number { return this.docs.length; }
    forEach(fn: (d: FakeDocSnapshot) => void): void { this.docs.forEach(fn); }
}

interface Filter { field: string; op: Op; value: unknown }

class FakeQuery {
    constructor(
        protected readonly db: FakeFirestore,
        readonly path: string,
        protected readonly filters: Filter[] = [],
        protected readonly order: Array<{ field: string; dir: 'asc' | 'desc' }> = [],
        protected readonly max: number | null = null,
    ) {}

    where(field: string, op: Op, value: unknown): FakeQuery {
        return new FakeQuery(this.db, this.path, [...this.filters, { field, op, value }], this.order, this.max);
    }

    orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): FakeQuery {
        return new FakeQuery(this.db, this.path, this.filters, [...this.order, { field, dir }], this.max);
    }

    limit(n: number): FakeQuery {
        return new FakeQuery(this.db, this.path, this.filters, this.order, n);
    }

    run(): FakeQuerySnapshot {
        let rows = this.db.children(this.path)
            .filter(([, data]) => this.filters.every((f) => matches(getField(data, f.field), f.op, f.value)))
            .filter(([, data]) => this.order.every((o) => getField(data, o.field) !== undefined));
        for (const o of [...this.order].reverse()) {
            rows = [...rows].sort((a, b) => compare(getField(a[1], o.field), getField(b[1], o.field)) * (o.dir === 'desc' ? -1 : 1));
        }
        if (this.max !== null) rows = rows.slice(0, this.max);
        return new FakeQuerySnapshot(rows.map(([path, data]) => new FakeDocSnapshot(this.db.doc(path), clone(data))));
    }

    async get(): Promise<FakeQuerySnapshot> { return this.run(); }

    count(): { get: () => Promise<{ data: () => { count: number } }> } {
        return { get: async () => ({ data: () => ({ count: this.run().size }) }) };
    }

    onSnapshot(onNext: (s: FakeQuerySnapshot) => void, _onError?: (e: Error) => void): () => void {
        return this.db.listen(() => onNext(this.run()), () => JSON.stringify(this.run().docs.map((d) => [d.ref.path, d.data()])));
    }
}

class FakeCollectionRef extends FakeQuery {
    get id(): string { return this.path.split('/').pop() as string; }
    doc(id?: string): FakeDocRef { return this.db.doc(`${this.path}/${id ?? `auto${++autoId}`}`); }
    async add(data: Data): Promise<FakeDocRef> { const ref = this.doc(); await ref.set(data); return ref; }
    async listDocuments(): Promise<FakeDocRef[]> { return this.db.children(this.path).map(([p]) => this.db.doc(p)); }
}

class FakeDocRef {
    constructor(private readonly db: FakeFirestore, readonly path: string) {}
    get id(): string { return this.path.split('/').pop() as string; }
    get parent(): FakeCollectionRef { return this.db.collection(this.path.split('/').slice(0, -1).join('/')); }
    collection(name: string): FakeCollectionRef { return this.db.collection(`${this.path}/${name}`); }
    snapshot(): FakeDocSnapshot { return new FakeDocSnapshot(this, this.db.read(this.path)); }
    async get(): Promise<FakeDocSnapshot> { return this.snapshot(); }
    async set(data: Data, opts?: { merge?: boolean }): Promise<void> { this.db.writeSet(this.path, data, !!opts?.merge); }
    async create(data: Data): Promise<void> {
        if (this.db.read(this.path)) throw new Error(`ALREADY_EXISTS: ${this.path}`);
        this.db.writeSet(this.path, data, false);
    }
    async update(fields: Data): Promise<void> { this.db.writeUpdate(this.path, fields); }
    async delete(): Promise<void> { this.db.writeDelete(this.path); }
    onSnapshot(onNext: (s: FakeDocSnapshot) => void, _onError?: (e: Error) => void): () => void {
        return this.db.listen(() => onNext(this.snapshot()), () => JSON.stringify(this.db.read(this.path) ?? null));
    }
}

type Write = () => void;

class FakeBatch {
    private writes: Write[] = [];
    constructor(private readonly db: FakeFirestore) {}
    set(ref: FakeDocRef, data: Data, opts?: { merge?: boolean }): this { this.writes.push(() => this.db.writeSet(ref.path, data, !!opts?.merge)); return this; }
    create(ref: FakeDocRef, data: Data): this { this.writes.push(() => this.db.writeSet(ref.path, data, false)); return this; }
    update(ref: FakeDocRef, fields: Data): this { this.writes.push(() => this.db.writeUpdate(ref.path, fields)); return this; }
    delete(ref: FakeDocRef): this { this.writes.push(() => this.db.writeDelete(ref.path)); return this; }
    async commit(): Promise<void> { for (const w of this.writes) w(); }
}

/** Reads see the state at the start; writes apply together at the end. Transactions run one at a time. */
class FakeTransaction extends FakeBatch {
    async get(target: FakeDocRef | FakeQuery): Promise<FakeDocSnapshot | FakeQuerySnapshot> {
        return target instanceof FakeDocRef ? target.snapshot() : target.run();
    }
    async getAll(...refs: FakeDocRef[]): Promise<FakeDocSnapshot[]> { return refs.map((r) => r.snapshot()); }
}

export class FakeFirestore {
    private docs = new Map<string, Data>();
    private listeners = new Set<() => void>();
    private txQueue: Promise<unknown> = Promise.resolve();

    asFirestore(): Firestore { return this as unknown as Firestore; }

    settings(): void { /* no-op */ }
    collection(path: string): FakeCollectionRef { return new FakeCollectionRef(this, path); }
    doc(path: string): FakeDocRef { return new FakeDocRef(this, path); }
    batch(): FakeBatch { return new FakeBatch(this); }
    async getAll(...refs: FakeDocRef[]): Promise<FakeDocSnapshot[]> { return refs.map((r) => r.snapshot()); }

    runTransaction<T>(fn: (tx: FakeTransaction) => Promise<T>): Promise<T> {
        const run = this.txQueue.then(async () => {
            const tx = new FakeTransaction(this);
            const result = await fn(tx);
            await tx.commit();
            return result;
        });
        this.txQueue = run.catch(() => undefined);
        return run;
    }

    // ─── Test helpers ───────────────────────────────────────────────────────

    /** Raw document data at a path, or undefined. */
    read(path: string): Data | undefined {
        const d = this.docs.get(path);
        return d === undefined ? undefined : clone(d);
    }

    /** Every document path, sorted. */
    paths(): string[] { return [...this.docs.keys()].sort(); }

    // ─── Internals ──────────────────────────────────────────────────────────

    children(collectionPath: string): Array<[string, Data]> {
        const depth = collectionPath.split('/').length + 1;
        return [...this.docs]
            .filter(([p]) => p.startsWith(`${collectionPath}/`) && p.split('/').length === depth)
            .sort(([a], [b]) => a.localeCompare(b));
    }

    writeSet(path: string, data: Data, merge: boolean): void {
        const clean = stripUndefined(clone(data)) as Data;
        const prev = this.docs.get(path);
        this.docs.set(path, merge && prev ? deepMerge(prev, clean) : clean);
        this.changed();
    }

    writeUpdate(path: string, fields: Data): void {
        const prev = this.docs.get(path);
        if (!prev) throw Object.assign(new Error(`5 NOT_FOUND: No document to update: ${path}`), { code: 5 });
        const next = clone(prev);
        for (const [k, v] of Object.entries(fields)) if (v !== undefined) setField(next, k, stripUndefined(clone(v)));
        this.docs.set(path, next);
        this.changed();
    }

    writeDelete(path: string): void {
        this.docs.delete(path);
        this.changed();
    }

    /**
     * Calls `fire` now (asynchronously, like the first snapshot) and after every write
     * that changes what `state` returns, so a listener sees only its own document or query.
     */
    listen(fire: () => void, state: () => string): () => void {
        let last: string | null = null;
        const check = () => {
            const now = state();
            if (now === last) return;
            last = now;
            fire();
        };
        this.listeners.add(check);
        queueMicrotask(() => { if (this.listeners.has(check)) check(); });
        return () => { this.listeners.delete(check); };
    }

    private changed(): void {
        for (const fire of [...this.listeners]) queueMicrotask(() => { if (this.listeners.has(fire)) fire(); });
    }
}
