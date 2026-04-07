# Data Migration Framework Design Document

A reusable, versioned data migration framework for browser-based applications using IndexedDB (Dexie.js) and localStorage (Zustand persist). Designed for offline-first apps where all data lives client-side and backward-compatible backup/restore is required.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Architecture Overview](#architecture-overview)
3. [Core Concepts](#core-concepts)
4. [Migration Interface](#migration-interface)
5. [Three Migration Surfaces](#three-migration-surfaces)
6. [Migration Registry](#migration-registry)
7. [Migration Pipeline](#migration-pipeline)
8. [Schema Snapshots](#schema-snapshots)
9. [Database Version Management (Dexie)](#database-version-management-dexie)
10. [Backup Import Integration](#backup-import-integration)
11. [localStorage Migration (Zustand persist)](#localstorage-migration-zustand-persist)
12. [Adding a New Migration — Step by Step](#adding-a-new-migration--step-by-step)
13. [Testing Strategy](#testing-strategy)
14. [Design Decisions & Trade-offs](#design-decisions--trade-offs)
15. [Complete Example: v3 to v4 Migration](#complete-example-v3-to-v4-migration)

---

## Problem Statement

In a client-side-only application, schema changes must handle three distinct migration surfaces simultaneously:

1. **Live IndexedDB data** — existing users opening the app after an update
2. **Backup JSON files** — old exports imported into a newer version of the app
3. **localStorage state** — Zustand-persisted settings that survive page reloads

Each surface uses a different storage mechanism and API, but the transformations must be **semantically identical** to ensure data consistency regardless of the upgrade path.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  migrations.ts                       │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │         Schema Snapshots (append-only)          │  │
│  │  TransactionV1, PositionV1, BackupPayloadV1    │  │
│  │  TransactionV2, PositionV2, BackupPayloadV2    │  │
│  │  ...                                            │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │         MIGRATIONS Registry                     │  │
│  │  Record<number, Migration>                      │  │
│  │                                                  │  │
│  │  key = source version (upgrading FROM)           │  │
│  │  value = { upgradePayload,                       │  │
│  │           upgradeIdb,                            │  │
│  │           upgradeLocalStorage? }                 │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │         migratePayload()                        │  │
│  │  Sequential pipeline: v1 → v2 → ... → vN       │  │
│  └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
         │                │                │
         ▼                ▼                ▼
    ┌─────────┐    ┌───────────┐    ┌──────────────┐
    │  db.ts   │    │ backup.ts │    │ settingsStore│
    │ (Dexie   │    │ (JSON     │    │ (Zustand     │
    │ upgrade) │    │  import)  │    │  persist     │
    │          │    │           │    │  migrate)    │
    └─────────┘    └───────────┘    └──────────────┘
```

---

## Core Concepts

### Version Number

A single integer (`DB_VERSION`) serves as the source of truth for the current schema version. It is used by:

- Dexie's `db.version(N)` chain
- The `version` field in backup JSON payloads
- The Zustand persist middleware's `version` option

### Append-Only Migrations

Migrations are **never modified** once released. Each new schema change adds a new version and a new migration entry. This guarantees that any user upgrading from any historical version follows the same deterministic path.

### Dual-Path Equivalence

Every migration defines at least two functions — `upgradePayload` (for backup JSON) and `upgradeIdb` (for live IndexedDB) — that must perform **semantically identical** transformations. A user who:

1. Exports at v3, updates the app to v5, then imports the backup
2. Simply opens the app at v5 (triggering Dexie's auto-upgrade from v3)

...must end up with the same data in both cases.

---

## Migration Interface

```typescript
import type { Transaction as DexieTransaction } from 'dexie';

type MigrationState = Record<string, unknown>;

interface Migration {
    /** One-line description shown in logs / error messages. */
    description: string;

    /**
     * Transform a backup payload from version N to version N+1.
     * Must set `payload.version` to N+1 in the returned object.
     * Pure function — no I/O.
     */
    upgradePayload: (payload: MigrationState) => MigrationState;

    /**
     * Transform live IndexedDB records in-place via Dexie's upgrade tx.
     * Wired to db.version(N+1).stores({...}).upgrade(fn).
     */
    upgradeIdb: (tx: DexieTransaction) => Promise<void> | void;

    /**
     * Transform Zustand-persist localStorage state from version N to N+1.
     * Only needed when the migration touches localStorage-persisted settings.
     * Must be semantically equivalent to the settings portion of upgradePayload.
     */
    upgradeLocalStorage?: (state: MigrationState) => MigrationState;
}
```

### Why three functions?

| Function | Trigger | Storage | When it runs |
|---|---|---|---|
| `upgradePayload` | User imports an old backup file | In-memory JSON | On backup import |
| `upgradeIdb` | User opens app after update | IndexedDB | Dexie auto-upgrade on `db.open()` |
| `upgradeLocalStorage` | User opens app after update | localStorage | Zustand persist `migrate` callback |

---

## Three Migration Surfaces

### 1. IndexedDB (Dexie)

Dexie handles IndexedDB versioning natively. Each version block declares the table schema (indexes) and an optional `upgrade` function:

```typescript
// db.ts
db.version(2)
    .stores({
        transactions: 'id, date, symbol, type',
        positions: 'id, symbol, status'
    })
    .upgrade(MIGRATIONS[1].upgradeIdb);
```

The `upgradeIdb` function receives a Dexie `Transaction` object for modifying records in-place:

```typescript
upgradeIdb: async (tx) => {
    await tx.table('positions').toCollection().modify((pos) => {
        if (!pos.type) pos.type = 'PRIMARY';
    });
}
```

**Key points:**
- Dexie automatically runs all needed upgrade steps sequentially (e.g., v1 → v2 → v3)
- The `.stores()` declaration defines **indexes**, not the full schema — IndexedDB is schemaless for non-indexed fields
- If a migration only touches localStorage data, `upgradeIdb` can be a no-op (`async () => {}`)
- Adding a new table only requires declaring it in `.stores()` — no `upgradeIdb` logic needed

### 2. Backup JSON Payload

The `upgradePayload` function transforms a deserialized JSON object. It is a **pure function** with no I/O:

```typescript
upgradePayload: (p) => {
    const v1 = p as BackupPayloadV1;
    return {
        ...v1,
        version: 2,
        positions: v1.positions.map(pos => ({
            ...pos,
            type: pos.type ?? 'PRIMARY',
        })),
    };
}
```

The `migratePayload()` pipeline chains these sequentially during backup import.

### 3. localStorage (Zustand persist)

Zustand's `persist` middleware supports a `migrate` function that runs when the stored version doesn't match the current version:

```typescript
// In the Zustand store definition
persist(
    (set, get) => ({ /* store implementation */ }),
    {
        name: 'settings-storage',
        version: DB_VERSION,
        migrate: (state, version) => {
            if (version < 4) {
                Object.assign(state, MIGRATIONS[3].upgradeLocalStorage!(state));
            }
            if (version < 5) {
                Object.assign(state, MIGRATIONS[4].upgradeLocalStorage!(state));
            }
            return state;
        },
    }
)
```

**Key points:**
- `upgradeLocalStorage` is optional — only needed when a migration touches persisted settings
- The `migrate` function uses `if (version < N)` guards, not sequential chaining, because Zustand calls it once with the stored version
- Each guard applies the corresponding migration's `upgradeLocalStorage` function

---

## Migration Registry

The registry is a plain object keyed by **source version** (the version being upgraded FROM):

```typescript
export const MIGRATIONS: Record<number, Migration> = {
    1: { /* v1 → v2 */ },
    2: { /* v2 → v3 */ },
    3: { /* v3 → v4 */ },
    4: { /* v4 → v5 */ },
};
```

**Why `Record<number, Migration>` instead of an array?**

- Keys explicitly communicate intent: `MIGRATIONS[3]` means "upgrade FROM v3"
- No off-by-one confusion with 0-based vs 1-based indexing
- Sparse keys are possible (though the test suite enforces contiguity)
- Easy to reference from `db.ts`: `db.version(4).upgrade(MIGRATIONS[3].upgradeIdb)`

---

## Migration Pipeline

The `migratePayload` function sequentially applies migrations until the payload reaches the target version:

```typescript
export function migratePayload(
    payload: Record<string, unknown>,
    targetVersion: number,
): Record<string, unknown> {
    let p = payload;
    while ((p.version as number) < targetVersion) {
        const currentVersion = p.version as number;
        const step = MIGRATIONS[currentVersion];
        if (!step) {
            throw new Error(
                `No migration defined for v${currentVersion} → v${currentVersion + 1}.`
            );
        }
        p = step.upgradePayload(p);
    }
    return p;
}
```

**Properties:**
- Returns the same reference if no migration is needed (enables cheap identity checks)
- Throws immediately if a migration step is missing (fail-fast)
- Each step must increment `version` by exactly 1
- The pipeline is pure — no side effects

---

## Schema Snapshots

Each version's data types are frozen as interfaces in `migrations.ts`. These are **append-only** — never modify an existing snapshot:

```typescript
// ---- v1 -------------------------------------------------------------------
export interface TransactionV1 {
    id: string;
    date: number;
    symbol: string;
    type: 'BUY' | 'SELL';
    price: number;
    quantity: number;
    amount: number;
    fee: number;
    orderId?: string;
    associatedPositionIds: string[];
    notes?: string;
}

export interface PositionV1 {
    id: string;
    symbol: string;
    type?: 'PRIMARY' | 'SHADOW'; // optional in v1
    status: 'OPEN' | 'CLOSED';
    entries: Array<{ transactionId: string; allocatedAmount: number }>;
    // ...
}

// ---- v2 -------------------------------------------------------------------
export interface PositionV2 extends Omit<PositionV1, 'type'> {
    type: 'PRIMARY' | 'SHADOW'; // now required
}
```

**Why snapshot types?**

- Migration code uses the snapshot types for safe casting, preventing accidental use of current types
- They document exactly what each version's data looked like
- TypeScript catches incorrect field access in migration logic

---

## Database Version Management (Dexie)

### db.ts Structure

```typescript
export const DB_VERSION = 5;

const db = new Dexie('MyAppDB') as Dexie & {
    transactions: EntityTable<Transaction, 'id'>,
    positions: EntityTable<Position, 'id'>,
    funds: EntityTable<Fund, 'id'>,
};

// v1 — initial schema
db.version(1).stores({
    transactions: 'id, date, symbol, type',
    positions: 'id, symbol, status'
});

// v2 — backfill data, no index changes
db.version(2)
    .stores({
        transactions: 'id, date, symbol, type',
        positions: 'id, symbol, status'
    })
    .upgrade(MIGRATIONS[1].upgradeIdb);

// v3 — new table, new index
db.version(3)
    .stores({
        transactions: 'id, date, symbol, type',
        positions: 'id, symbol, status, fundId',
        funds: 'id, status, createdAt',
    })
    .upgrade(MIGRATIONS[2].upgradeIdb);

// v4, v5 — localStorage-only changes, IDB unchanged
db.version(4).stores({ /* same as v3 */ }).upgrade(MIGRATIONS[3].upgradeIdb);
db.version(5).stores({ /* same as v3 */ }).upgrade(MIGRATIONS[4].upgradeIdb);
```

### Multi-Tab Handling

```typescript
db.on('versionchange', () => {
    db.close();
    console.warn('Database upgraded by another tab. Please refresh.');
});
```

### Startup Compatibility Check

Before opening the database, probe the actual version to detect forward-incompatible data:

```typescript
export type DbCompatibility = 'ok' | 'needs-upgrade' | 'incompatible';

export function getDbCompatibilityStatus(actual: number): DbCompatibility {
    if (actual === 0 || actual === DB_VERSION) return 'ok';
    if (actual < DB_VERSION) return 'needs-upgrade';
    return 'incompatible'; // stored version is ahead of code
}
```

The `'incompatible'` case occurs when a user downgrades the app — the UI should prompt them to update rather than silently corrupting data.

---

## Backup Import Integration

The backup import flow in `backup.ts`:

```typescript
async function importData(file: File): Promise<void> {
    const raw = JSON.parse(content);

    // 1. Validate identity
    if (raw.appName !== 'MyApp') throw new Error('Invalid backup file.');

    // 2. Reject future versions
    if (raw.version > DB_VERSION) {
        throw new Error('Backup is from a newer version. Please update the app.');
    }

    // 3. Migrate older backups
    const payload = raw.version < DB_VERSION
        ? migratePayload(raw, DB_VERSION)
        : raw;

    // 4. Clear and restore database
    await db.transactions.clear();
    await db.positions.clear();
    await db.transactions.bulkAdd(payload.transactions);
    await db.positions.bulkAdd(payload.positions);

    // 5. Restore settings
    if (payload.settings) {
        useSettingsStore.setState(payload.settings);
    }
}
```

The `migratePayload` call transparently handles any version gap — a v1 backup imported into a v5 app runs through all four intermediate migrations.

---

## localStorage Migration (Zustand persist)

Zustand's persist middleware integration:

```typescript
export const useSettingsStore = create(
    persist(
        (set, get) => ({
            // ... store state and actions
        }),
        {
            name: 'settings-storage',
            version: DB_VERSION, // shares the same version number
            migrate: (state, version) => {
                // Apply each migration step that has an upgradeLocalStorage
                if (version < 4) {
                    Object.assign(state, MIGRATIONS[3].upgradeLocalStorage!(state));
                }
                if (version < 5) {
                    Object.assign(state, MIGRATIONS[4].upgradeLocalStorage!(state));
                }
                return state;
            },
        }
    )
);
```

**Pattern:** Use `if (version < N)` guards so that users upgrading from any older version get all necessary migrations applied.

---

## Adding a New Migration — Step by Step

Example: Adding a `tags` field to positions in v6.

### 1. Increment `DB_VERSION` in `db.ts`

```typescript
export const DB_VERSION = 6;
```

### 2. Add schema snapshot types in `migrations.ts`

```typescript
// ---- v6 -------------------------------------------------------------------
// Positions gain a tags field for user-defined categorization.

export interface PositionV6 extends PositionV5 {
    tags: string[];
}

export interface BackupPayloadV6 extends Omit<BackupPayloadV5, 'version' | 'positions'> {
    version: 6;
    positions: PositionV6[];
}
```

### 3. Add migration entry to `MIGRATIONS`

```typescript
// v5 → v6
5: {
    description: 'Add tags field to positions (default empty array)',
    upgradePayload: (p) => {
        const v5 = p as unknown as BackupPayloadV5;
        return {
            ...v5,
            version: 6,
            positions: v5.positions.map(pos => ({
                ...pos,
                tags: [],
            })),
        };
    },
    upgradeIdb: async (tx) => {
        await tx.table('positions').toCollection().modify((pos) => {
            pos.tags = pos.tags ?? [];
        });
    },
    // No upgradeLocalStorage needed — tags is in IndexedDB, not localStorage
},
```

### 4. Add Dexie version block in `db.ts`

```typescript
db.version(6)
    .stores({
        transactions: 'id, date, symbol, type',
        positions: 'id, symbol, status, fundId',  // add ', tags' if you need an index
        funds: 'id, status, createdAt',
    })
    .upgrade(MIGRATIONS[5].upgradeIdb);
```

### 5. Update current types in `types.ts`

```typescript
interface Position {
    // ... existing fields
    tags: string[];  // NEW
}
```

### 6. Add tests in `migrations.test.ts`

```typescript
describe('MIGRATIONS[5] v5 → v6', () => {
    it('adds empty tags array to positions', () => {
        const payload = makePayload(5, {
            positions: [{ id: 'p1', symbol: 'BTC/USDT', tags: undefined }],
        });
        const result = MIGRATIONS[5].upgradePayload(payload);
        expect(result.version).toBe(6);
        expect(result.positions[0].tags).toEqual([]);
    });
});
```

### 7. If the migration touches localStorage, update the Zustand `migrate` function

```typescript
if (version < 6) {
    Object.assign(state, MIGRATIONS[5].upgradeLocalStorage!(state));
}
```

---

## Testing Strategy

### Structural Tests (automated contracts)

These tests validate invariants across all migrations without knowing the specifics:

```typescript
describe('MIGRATIONS registry', () => {
    it('each entry has the required shape', () => {
        for (const [key, migration] of Object.entries(MIGRATIONS)) {
            expect(typeof migration.description).toBe('string');
            expect(migration.description.length).toBeGreaterThan(0);
            expect(typeof migration.upgradePayload).toBe('function');
            expect(typeof migration.upgradeIdb).toBe('function');
        }
    });

    it('each entry increments version by exactly 1', () => {
        for (const [key, migration] of Object.entries(MIGRATIONS)) {
            const fromVersion = Number(key);
            const result = migration.upgradePayload(makePayload(fromVersion));
            expect(result.version).toBe(fromVersion + 1);
        }
    });

    it('entries form a contiguous chain from 1 to DB_VERSION - 1', () => {
        for (let v = 1; v < DB_VERSION; v++) {
            expect(MIGRATIONS[v]).toBeDefined();
        }
    });
});
```

### Pipeline Tests

```typescript
describe('migratePayload', () => {
    it('returns same reference when already at target', () => {
        const p = makePayload(DB_VERSION);
        expect(migratePayload(p, DB_VERSION)).toBe(p);
    });

    it('applies multiple steps in sequence', () => { /* ... */ });

    it('throws on missing migration step', () => {
        expect(() => migratePayload(makePayload(0), 1))
            .toThrow('No migration defined for v0 → v1');
    });

    it('does not mutate the original payload', () => { /* ... */ });
});
```

### Per-Migration Tests

Each migration gets its own `describe` block testing:

- Happy path (fields are transformed correctly)
- Edge cases (missing optional fields, empty arrays)
- `upgradeLocalStorage` (if applicable)
- Data not targeted by the migration is preserved unchanged

---

## Design Decisions & Trade-offs

### 1. Single version number shared across all surfaces

**Decision:** IndexedDB, backup payloads, and localStorage all use the same `DB_VERSION`.

**Rationale:** Simplifies reasoning — "the app is at version N" means the same thing everywhere. The cost is that a localStorage-only change still bumps the IndexedDB version (requiring a no-op `upgradeIdb`), but this is a minor inefficiency.

**Alternative considered:** Separate version tracks per storage layer. Rejected because it dramatically increases complexity and makes backup compatibility harder to reason about.

### 2. Registry keyed by source version, not target

**Decision:** `MIGRATIONS[3]` means "upgrade FROM v3 to v4".

**Rationale:** The source version is what you know at runtime (from the stored data). Looking up the migration by source version is a natural `O(1)` operation. The relationship `MIGRATIONS[N].upgradePayload` produces version `N+1` is enforced by tests.

### 3. Pure `upgradePayload` functions

**Decision:** Payload migrations are pure functions with no I/O.

**Rationale:** Pure functions are trivially testable, composable, and predictable. The pipeline can be tested without mocking IndexedDB or localStorage.

### 4. Append-only schema snapshots

**Decision:** Frozen interface types for each version, never modified after release.

**Rationale:** Migration code must work with the data shape as it existed at that version, not the current shape. Snapshot types make this explicit and compiler-checkable.

### 5. No rollback support

**Decision:** Migrations are forward-only. There is no `downgradePayload` or `downgradeIdb`.

**Rationale:** Rollback adds significant complexity and is rarely needed in client-side apps. Users who need to downgrade can restore from a backup taken before the upgrade. The `'incompatible'` compatibility check prevents accidental data corruption from version mismatches.

---

## Complete Example: v3 to v4 Migration

This migration renames `dataSource` to `dataProvider` in pairConfigs (settings stored in localStorage) and maps stock exchange values to `'Yahoo Finance'`.

```typescript
// Schema snapshot
interface PairConfigV3 {
    pair: string;
    exchange: string;
    dataSource: string;  // OLD field name
    currency: string;
}

interface PairConfigV4 {
    pair: string;
    exchange: string;
    dataProvider: string; // NEW field name
    currency: string;
}

// Migration entry
const STOCK_EXCHANGES = new Set(['NYSE', 'NASDAQ', 'SSE', 'SZSE']);

MIGRATIONS[3] = {
    description: 'Rename pairConfigs.dataSource → dataProvider; map stock exchanges to Yahoo Finance',

    // Backup JSON transformation
    upgradePayload: (p) => {
        const v3 = p as BackupPayloadV3;
        const rawConfigs = v3.settings?.pairConfigs;
        return {
            ...v3,
            version: 4,
            settings: {
                ...v3.settings,
                ...(rawConfigs !== undefined && {
                    pairConfigs: rawConfigs.map(({ dataSource, ...rest }) => ({
                        ...rest,
                        dataProvider: STOCK_EXCHANGES.has(dataSource)
                            ? 'Yahoo Finance'
                            : dataSource,
                    })),
                }),
            },
        };
    },

    // IndexedDB — no-op (pairConfigs is in localStorage, not IDB)
    upgradeIdb: async () => {},

    // localStorage transformation
    upgradeLocalStorage: (state) => {
        const configs = state.pairConfigs as PairConfigV3[] | undefined;
        if (!configs) return state;
        return {
            ...state,
            pairConfigs: configs.map(({ dataSource, ...rest }) => ({
                ...rest,
                dataProvider: STOCK_EXCHANGES.has(dataSource)
                    ? 'Yahoo Finance'
                    : dataSource,
            })),
        };
    },
};
```

This example demonstrates all three surfaces:
- **`upgradePayload`**: Handles backup JSON where pairConfigs is nested under `settings`
- **`upgradeIdb`**: No-op because the affected data lives in localStorage
- **`upgradeLocalStorage`**: Same transformation but on the flat Zustand state shape

---

## Checklist for Adopting This Pattern

- [ ] Define a single `DB_VERSION` constant as the source of truth
- [ ] Create the `Migration` interface with `upgradePayload`, `upgradeIdb`, and optional `upgradeLocalStorage`
- [ ] Create the `MIGRATIONS` registry as `Record<number, Migration>`
- [ ] Implement `migratePayload()` as a sequential pipeline
- [ ] Wire Dexie's `.upgrade()` to `MIGRATIONS[N].upgradeIdb`
- [ ] Wire Zustand persist's `migrate` to `MIGRATIONS[N].upgradeLocalStorage`
- [ ] Add structural tests that validate all migrations automatically
- [ ] Add per-migration unit tests for each new version
- [ ] Add a compatibility check at app startup for forward-version detection
- [ ] Freeze schema snapshot types as append-only interfaces
