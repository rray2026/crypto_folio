// =============================================================================
// Data Migration Framework
// =============================================================================
// Each time DB_VERSION is incremented you must:
//   1. Snapshot the OLD schema types here (TransactionVN, PositionVN, BackupPayloadVN).
//   2. Add a new entry to MIGRATIONS (key = old version).
//   3. Add db.version(N+1).stores({...}).upgrade(MIGRATIONS[N].upgradeIdb) in db.ts.
//
// The two halves of every migration:
//   upgradePayload — transforms a backup JSON file from vN → vN+1 (pure, no I/O).
//   upgradeIdb     — transforms live IndexedDB records in-place via Dexie's upgrade tx.
//
// Both must perform semantically identical transformations so that a user who
// imports an old backup after an in-place upgrade ends up with the same data.
// =============================================================================

// ---------------------------------------------------------------------------
// Schema snapshots (append-only — never edit an existing VN block)
// ---------------------------------------------------------------------------

/** Transactions table as of schema v1. */
export interface TransactionV1 {
    id: string;
    date: number;               // Unix timestamp ms
    symbol: string;             // e.g. "BTC/USDT"
    type: 'BUY' | 'SELL';
    price: number;
    quantity: number;
    amount: number;             // price × quantity
    fee: number;
    orderId?: string;
    associatedPositionIds: string[];
    notes?: string;
}

/** Positions table as of schema v1. */
export interface PositionV1 {
    id: string;
    symbol: string;
    strategyName?: string;
    type: 'PRIMARY' | 'SHADOW';
    status: 'OPEN' | 'CLOSED';
    entries: Array<{ transactionId: string; allocatedAmount: number }>;
    journal?: {
        entryReason?: string;
        exitReason?: string;
        moodScore?: number;     // 1–5
        reviewNotes?: string;
    };
    notes?: string;
    startDate: number;
    endDate?: number;
}

/** Full backup payload shape as of v1. */
export interface BackupPayloadV1 {
    version: 1;
    timestamp: number;
    appName: 'CryptoFolio';
    transactions: TransactionV1[];
    positions: PositionV1[];
    settings: {
        predefinedPairs: string[];
        dashboardTimeRange: string;
        theme: string;
    };
}

// When bumping to v2, append here (do NOT touch V1 blocks above):
//
// export interface TransactionV2 extends TransactionV1 {
//     exchange: string | null;
// }
//
// export interface BackupPayloadV2 extends Omit<BackupPayloadV1, 'version' | 'transactions'> {
//     version: 2;
//     transactions: TransactionV2[];
// }

// ---------------------------------------------------------------------------
// Migration interface
// ---------------------------------------------------------------------------

export interface Migration {
    /** One-line description shown in logs / error messages. */
    description: string;

    /**
     * Transform a backup payload from version N to version N+1.
     * Must set `payload.version` to N+1 in the returned object.
     * Input is typed loosely because the caller may have deserialized old JSON.
     */
    upgradePayload: (payload: Record<string, any>) => Record<string, any>;

    /**
     * Called by Dexie's `.upgrade()` to transform live IndexedDB records.
     * Register in db.ts:
     *   db.version(N+1).stores({...}).upgrade(MIGRATIONS[N].upgradeIdb)
     *
     * Must perform the same logical transformation as upgradePayload.
     */
    upgradeIdb: (tx: any) => Promise<void> | void;
}

// ---------------------------------------------------------------------------
// Migration registry
// ---------------------------------------------------------------------------
// Key   = source version (being upgraded FROM).
// Value = migration that produces source + 1.
//
// Example — v1 → v2 (not active):
//
//   1: {
//     description: 'Add exchange field to transactions',
//     upgradePayload: (p) => ({
//       ...p,
//       version: 2,
//       transactions: (p.transactions as TransactionV1[]).map(t => ({ exchange: null, ...t })),
//     }),
//     upgradeIdb: (tx) =>
//       tx.table('transactions').toCollection().modify((t: TransactionV1) => {
//         (t as any).exchange ??= null;
//       }),
//   },

export const MIGRATIONS: Record<number, Migration> = {
    // Add future migrations here.
};

// ---------------------------------------------------------------------------
// Migration pipeline
// ---------------------------------------------------------------------------

/**
 * Sequentially applies MIGRATIONS until `payload.version === targetVersion`.
 * Returns the same object reference when no migration is needed.
 * Throws when a required migration step is absent.
 */
export function migratePayload(
    payload: Record<string, any>,
    targetVersion: number,
): Record<string, any> {
    let p = payload;
    while (p.version < targetVersion) {
        const step = MIGRATIONS[p.version];
        if (!step) {
            throw new Error(
                `No migration defined for v${p.version} → v${p.version + 1}. ` +
                `Add an entry to MIGRATIONS in migrations.ts.`
            );
        }
        p = step.upgradePayload(p);
    }
    return p;
}
