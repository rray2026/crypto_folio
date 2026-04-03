# Backup and Restore System

## 1. Overview

The backup and restore feature is implemented in `src/lib/backup.ts`. It is the only mechanism for migrating user data across devices or upgrading between app versions (since there is no server).

**Core functions:**
- `exportData()`: exports all data as a downloadable JSON file
- `importData(file)`: restores data from a JSON file

---

## 2. Backup File Format

### 2.1 BackupPayload structure

```typescript
interface BackupPayload {
  version: number;         // Backup version (current: 4)
  timestamp: number;       // Unix timestamp of the export
  appName: 'CryptoFolio'; // App identifier (used for validation)
  transactions: Transaction[];
  positions: Position[];
  funds: Fund[];
  settings: {
    predefinedPairs: string[];
    pairConfigs?: PairConfig[];
    dashboardTimeRange: DashboardTimeRange;
    theme: Theme;
    // Note: prices cache is NOT exported (real-time data; re-fetched on restore)
    // Note: pinnedPairs may be absent in pre-v4 backups
  };
}
```

### 2.2 File naming

```
cryptofolio-backup-YYYY-MM-DD.json
```

Example: `cryptofolio-backup-2026-04-03.json`

---

## 3. Export Flow (`exportData`)

```typescript
async function exportData(): Promise<void> {
  // 1. Read all data from IndexedDB
  const [transactions, positions, funds] = await Promise.all([
    db.transactions.toArray(),
    db.positions.toArray(),
    db.funds.toArray(),
  ]);

  // 2. Read Zustand persisted settings from localStorage
  const settingsRaw = localStorage.getItem('crypto-folio-settings');
  const settings = settingsRaw ? JSON.parse(settingsRaw) : {};

  // 3. Build the payload
  const payload: BackupPayload = {
    version: BACKUP_VERSION,  // current: 4
    timestamp: Date.now(),
    appName: 'CryptoFolio',
    transactions,
    positions,
    funds,
    settings: {
      predefinedPairs: settings.state?.predefinedPairs ?? [],
      pairConfigs: settings.state?.pairConfigs ?? [],
      dashboardTimeRange: settings.state?.dashboardTimeRange ?? 'ALL',
      theme: settings.state?.theme ?? 'system',
    },
  };

  // 4. Serialize and trigger download
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cryptofolio-backup-${formatDate(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
```

**Key design decisions:**
- The price cache (`prices`) is not exported — it is real-time data and will be re-fetched after restore.
- Settings are read directly from `localStorage` rather than from the Zustand store instance, ensuring they can be read at any point in time.

---

## 4. Import Flow (`importData`)

```typescript
async function importData(file: File): Promise<void> {
  // 1. Read and parse the JSON
  const text = await file.text();
  let payload: BackupPayload = JSON.parse(text);

  // 2. Validate the file
  if (payload.appName !== 'CryptoFolio') {
    throw new Error('Not a valid CryptoFolio backup file');
  }
  if (typeof payload.version !== 'number') {
    throw new Error('Backup file is missing a version field');
  }
  if (payload.version > BACKUP_VERSION) {
    throw new Error('Backup file was created with a newer version of the app — please update the app first');
  }

  // 3. Migrate if the backup version is older than the current version
  if (payload.version < BACKUP_VERSION) {
    payload = migratePayload(payload, payload.version, BACKUP_VERSION);
  }

  // 4. Clear all existing data
  await Promise.all([
    db.transactions.clear(),
    db.positions.clear(),
    db.funds.clear(),
  ]);

  // 5. Bulk-insert the new data
  await Promise.all([
    db.transactions.bulkAdd(payload.transactions),
    db.positions.bulkAdd(payload.positions),
    db.funds.bulkAdd(payload.funds ?? []),
  ]);

  // 6. Restore settings to localStorage
  const existingRaw = localStorage.getItem('crypto-folio-settings');
  const existing = existingRaw ? JSON.parse(existingRaw) : { state: {} };
  const mergedSettings = {
    ...existing,
    state: {
      ...existing.state,
      predefinedPairs: payload.settings.predefinedPairs ?? existing.state.predefinedPairs,
      pairConfigs: payload.settings.pairConfigs ?? existing.state.pairConfigs,
      dashboardTimeRange: payload.settings.dashboardTimeRange ?? existing.state.dashboardTimeRange,
      theme: payload.settings.theme ?? existing.state.theme,
    },
    version: BACKUP_VERSION,
  };
  localStorage.setItem('crypto-folio-settings', JSON.stringify(mergedSettings));

  // 7. Force a full page reload to reinitialize React and Zustand from fresh data
  window.location.reload();
}
```

**Key design decisions:**

**Why `window.location.reload()`?**

After import completes, the in-memory Zustand state is inconsistent with the newly written database (Zustand still holds the old data). A forced reload ensures all state is re-initialized from scratch. Without it, the UI would display stale data even though the database now contains the new data.

**Why `clear()` then `bulkAdd()` instead of `put()`?**

Avoids mixing old and new data. Using `put()` (upsert) would leave records that existed in the old database but are absent from the backup, resulting in a dirty dataset.

**Settings merge strategy:**

Uses a "backup wins" merge: fields present in the backup overwrite the current values; fields absent from the backup keep the current values. This prevents losing current settings when restoring from an older backup that lacked certain fields.

---

## 5. Version Migration (`migratePayload`)

```typescript
// src/lib/migrations.ts
export function migratePayload(
  payload: BackupPayload,
  fromVersion: number,
  toVersion: number
): BackupPayload {
  let current = { ...payload };

  for (let v = fromVersion; v < toVersion; v++) {
    // MIGRATIONS array is 0-indexed; index 0 handles v1→v2
    const migration = MIGRATIONS[v - 1];
    current = migration.upgradePayload(current);
    current.version = v + 1;
  }

  return current;
}
```

**Example:** importing a v2 backup into a v4 app:
1. Run `MIGRATIONS[1].upgradePayload()` (v2 → v3): ensure the `funds` array exists.
2. Run `MIGRATIONS[2].upgradePayload()` (v3 → v4): rename `dataSource` → `dataProvider`.

---

## 6. Error Handling

Errors that can be thrown during import:

| Error | Cause | Handling |
|---|---|---|
| `appName` mismatch | Not a CryptoFolio backup | Prompt user to select the correct file |
| `version` missing or non-numeric | File is corrupted | Inform user the file is corrupted |
| Backup version > app version | Backup from a newer app | Prompt user to update the app |
| `JSON.parse` failure | File content is not valid JSON | Inform user the file is corrupted |
| IndexedDB write failure | Insufficient storage space or permission issue | Display error details to the user |

All exceptions are caught by the UI layer (Settings page) and surfaced as toast notifications.

---

## 7. Development Notes

### Maintaining backup compatibility when changing data structures

Every time `Transaction`, `Position`, `Fund`, or Settings structure changes, you must:

1. Add a new Migration to `src/lib/migrations.ts` (implement `upgradePayload`).
2. Increment `BACKUP_VERSION` (keep it in sync with `DB_VERSION`).
3. Confirm that `exportData` in `src/lib/backup.ts` correctly exports the new fields.
4. Add tests for the new migration (`src/lib/backup.test.ts` and `src/lib/migrations.test.ts`).

### Testing backup migrations

```typescript
// src/lib/backup.test.ts example
it('imports v2 backup and migrates to v4', async () => {
  const v2Payload = {
    version: 2,
    appName: 'CryptoFolio',
    transactions: [...],
    positions: [{ id: '1', type: undefined }], // v2 may lack the type field
    funds: undefined,
    settings: { pairConfigs: [{ dataSource: 'Binance' }] },
  };

  await importData(new File([JSON.stringify(v2Payload)], 'backup.json'));

  // Verify positions all have a type
  const positions = await db.positions.toArray();
  expect(positions[0].type).toBe('PRIMARY');

  // Verify pairConfig field name has been migrated
  const settings = JSON.parse(localStorage.getItem('crypto-folio-settings')!);
  expect(settings.state.pairConfigs[0].dataProvider).toBe('Binance');
  expect(settings.state.pairConfigs[0].dataSource).toBeUndefined();
});
```
