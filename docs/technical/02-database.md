# Database Design and Migration System

## 1. Overview

- **Engine**: IndexedDB (native browser API)
- **Wrapper**: [Dexie.js](https://dexie.org/) v4
- **Database name**: `CryptoFolioDB`
- **Current version**: 4
- **Source files**: `src/lib/db.ts`, `src/lib/migrations.ts`

All data is stored entirely in the user's browser locally. There is no server-side persistence of any kind.

---

## 2. Database Schema (current v4)

```typescript
// src/lib/db.ts
const db = new Dexie('CryptoFolioDB');

db.version(1).stores({
  transactions: 'id, date, symbol, type',
  positions: 'id, symbol, status',
});

db.version(2).stores({
  transactions: 'id, date, symbol, type',
  positions: 'id, symbol, status',
}).upgrade(tx => migrations[0].upgradeIdb(tx));

db.version(3).stores({
  transactions: 'id, date, symbol, type',
  positions: 'id, symbol, status, fundId',  // fundId index added
  funds: 'id, status, createdAt',           // funds table added
}).upgrade(tx => migrations[1].upgradeIdb(tx));

db.version(4).stores({
  transactions: 'id, date, symbol, type',
  positions: 'id, symbol, status, fundId',
  funds: 'id, status, createdAt',
}).upgrade(tx => migrations[2].upgradeIdb(tx));
```

**Index reference:**

| Table | Indexed fields | Purpose |
|---|---|---|
| transactions | `id` | Primary key, UUID lookup |
| transactions | `date` | Filter by time range |
| transactions | `symbol` | Filter by trading pair |
| transactions | `type` | Filter by BUY/SELL direction |
| positions | `id` | Primary key |
| positions | `symbol` | Query by asset |
| positions | `status` | Filter OPEN/CLOSED |
| positions | `fundId` | Find all positions in a fund |
| funds | `id` | Primary key |
| funds | `status` | Filter ACTIVE/CLOSED |
| funds | `createdAt` | Sort by creation time |

> **Note**: The `stores()` parameter in Dexie only defines **indexes**, not all fields. All object fields are stored; only fields declared here can be used in `where()` queries.

---

## 3. Version Compatibility Check

```typescript
// src/lib/db.ts
export function getDbCompatibilityStatus(
  storedVersion: number
): 'ok' | 'needs-upgrade' | 'incompatible'
```

**Return values:**
- `'ok'`: Database version matches the app version, or the database does not exist yet (first use).
- `'needs-upgrade'`: The stored database version is lower than the current app version. Dexie will automatically trigger the upgrade callback on first access.
- `'incompatible'`: The stored database version is **higher** than the current app version, meaning the user previously used a newer version of the app. The current code cannot safely read the data; the user must be prompted to update the app.

This check is performed at app startup (`App.tsx`). If the result is `'incompatible'`, a warning UI is shown that blocks normal operations.

---

## 4. Migration System Design

### 4.1 Design principles

1. **Immutable**: Published migration versions are never modified — only new versions are added.
2. **Dual-track migrations**: Each migration handles both the **live database** (IndexedDB upgrade) and **backup files** (JSON transformation) independently.
3. **Sequential execution**: Migrations are applied step by step from the old version to the new version — no skipping.

### 4.2 Migration object structure

```typescript
// src/lib/migrations.ts
interface Migration {
  description: string;           // Human-readable description of the change
  upgradePayload: (             // JSON transformation for backup files
    payload: BackupPayload
  ) => BackupPayload;
  upgradeIdb: (                 // Live IndexedDB upgrade function
    tx: Dexie.Transaction
  ) => Promise<void>;
  upgradeLocalStorage?: (       // Optional: transform Zustand persisted state in localStorage
    state: unknown
  ) => unknown;
}

export const MIGRATIONS: Migration[] = [
  /* index 0: v1 → v2 */
  /* index 1: v2 → v3 */
  /* index 2: v3 → v4 */
];
```

### 4.3 Migration details by version

#### v1 → v2 (MIGRATIONS[0])

**Changes:**
- Position gains `type` field: all existing positions default to `'PRIMARY'`.
- Transaction gains `orderId` field: all existing transactions default to `undefined` (cannot be back-filled retroactively).

**IndexedDB upgrade logic:**
```typescript
// Iterate all positions and add the default type where missing
const positions = await tx.table('positions').toArray();
await Promise.all(
  positions.map(p =>
    !p.type
      ? tx.table('positions').update(p.id, { type: 'PRIMARY' })
      : Promise.resolve()
  )
);
```

**Backup file transformation:**
```typescript
// Add type: 'PRIMARY' to each position record if missing
payload.positions = payload.positions.map(p => ({
  ...p,
  type: p.type ?? 'PRIMARY',
}));
```

---

#### v2 → v3 (MIGRATIONS[1])

**Changes:**
- New `funds` table (Dexie creates this automatically via the schema declaration; no data transform needed).
- Position gains optional `fundId` field: no back-fill required; defaults to `undefined`.

**IndexedDB upgrade logic:** No data transform needed (Dexie handles table creation).

**Backup file transformation:**
```typescript
// Ensure the backup payload includes an empty funds array
payload.funds = payload.funds ?? [];
```

---

#### v3 → v4 (MIGRATIONS[2])

**Changes:**
- Settings `pairConfigs[].dataSource` field renamed to `dataProvider`.
- Old exchange values (`'NYSE'`, `'NASDAQ'`, `'SSE'`, `'SZSE'`) mapped to `dataProvider: 'Yahoo Finance'`.

**IndexedDB upgrade logic:** No IndexedDB changes (settings are stored in localStorage).

**Backup file transformation:**
```typescript
payload.settings?.pairConfigs?.forEach(config => {
  if (config.dataSource) {
    config.dataProvider = config.dataSource;
    delete config.dataSource;
  }
  // Map stock exchange values
  if (['NYSE', 'NASDAQ', 'SSE', 'SZSE'].includes(config.exchange)) {
    config.dataProvider = 'Yahoo Finance';
  }
});
```

**localStorage upgrade logic:**
```typescript
// Apply the same rename to the Zustand persist state
state.pairConfigs = state.pairConfigs?.map(c => ({
  ...c,
  dataProvider: c.dataSource ?? c.dataProvider,
  dataSource: undefined,
}));
```

---

### 4.4 Backup migration entry point

```typescript
// src/lib/migrations.ts
export function migratePayload(
  payload: BackupPayload,
  fromVersion: number,
  toVersion: number
): BackupPayload {
  let current = { ...payload };
  for (let v = fromVersion; v < toVersion; v++) {
    current = MIGRATIONS[v - 1].upgradePayload(current);
    current.version = v + 1;
  }
  return current;
}
```

When a backup file is imported, `backup.ts` calls this function to incrementally upgrade the old JSON to the current version before writing it to the database.

---

## 5. Relationship with Zustand Stores

Dexie is the **only persistent write path**:
- Zustand stores (`useTransactionStore`, `usePositionStore`, `useFundStore`) call Dexie's `add()`, `put()`, and `delete()` to persist data.
- UI components subscribe to database changes via `useLiveQuery()` (from `dexie-react-hooks`) for reactive updates.
- Zustand state and IndexedDB are not bidirectionally synced — stores do not cache full data sets; they query on demand.

---

## 6. Procedure for Adding a New Version

When a data structure change is needed:

1. **In `src/lib/db.ts`**: Copy the latest `db.version(N).stores(...)` block, increment the version to `N+1`, apply schema changes in `.stores()`, and add `.upgrade(tx => migrations[N-1].upgradeIdb(tx))`.

2. **In `src/lib/migrations.ts`**: Append a new Migration object to the end of the `MIGRATIONS` array. Implement `upgradePayload`, `upgradeIdb`, and optionally `upgradeLocalStorage`.

3. **Update `DB_VERSION` constant** in `src/lib/db.ts` to the new version number.

4. **Update `BACKUP_VERSION` constant** in `src/lib/backup.ts`.

5. **Write tests** for the new migration in `src/lib/migrations.test.ts`.

> Never modify existing migration entries — they may have already been executed in users' browsers.
