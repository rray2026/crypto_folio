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

// ---- v1 -------------------------------------------------------------------
// Initial schema. type on Position was not always populated; orderId on
// Transaction was missing for Binance-imported records whose id was numeric.

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
    orderId?: string;           // may be absent in v1 data
    associatedPositionIds: string[];
    notes?: string;
}

/** Positions table as of schema v1. */
export interface PositionV1 {
    id: string;
    symbol: string;
    strategyName?: string;
    type?: 'PRIMARY' | 'SHADOW'; // was not always populated in v1 data
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

// ---- v2 -------------------------------------------------------------------
// positions.type is now always set (defaults to 'PRIMARY').
// transactions.orderId is backfilled for records whose id is a numeric
// exchange order ID (8+ digit pattern from Binance imports).

/** Transactions table as of schema v2 (structurally unchanged from v1). */
export type TransactionV2 = TransactionV1;

/** Positions table as of schema v2 — type is now required. */
export interface PositionV2 extends Omit<PositionV1, 'type'> {
    type: 'PRIMARY' | 'SHADOW';
}

/** Full backup payload shape as of v2. */
export interface BackupPayloadV2 extends Omit<BackupPayloadV1, 'version' | 'positions'> {
    version: 2;
    positions: PositionV2[];
}

// ---- v3 -------------------------------------------------------------------
// New funds table added. Position gains optional fundId field (no backfill needed).
// Note: settings.pairConfigs (in backup payload) gained a `dataSource` field around
// this time, but was never formally typed here — that field is renamed in v4.

/** Positions table as of schema v3 — adds optional fundId. */
export interface PositionV3 extends PositionV2 {
    fundId?: string;
}

/** Funds table as of schema v3. */
export interface FundV3 {
    id: string;
    name: string;
    description?: string;
    initialAmount: number;
    initialShares: number;
    currency: string;
    createdAt: number;
    status: 'ACTIVE' | 'CLOSED';
}

/** Full backup payload shape as of v3. */
export interface BackupPayloadV3 extends Omit<BackupPayloadV2, 'version' | 'positions'> {
    version: 3;
    positions: PositionV3[];
    funds: FundV3[];
}

// ---- v4 -------------------------------------------------------------------
// settings.pairConfigs: dataSource field renamed to dataProvider;
// stock exchange values (NYSE/NASDAQ/SSE/SZSE) mapped to 'Yahoo Finance'.
// No IndexedDB schema changes — pairConfigs lives in localStorage only.

/** Stock exchanges whose price data is provided by Yahoo Finance. */
const STOCK_EXCHANGES = new Set(['NYSE', 'NASDAQ', 'SSE', 'SZSE']);

/** PairConfig shape as stored in backup settings as of v3 (uses dataSource). */
interface PairConfigV3 {
    pair: string;
    exchange: string;
    dataSource: string;
    currency: string;
}

/** PairConfig shape as stored in backup settings as of v4 (uses dataProvider). */
export interface PairConfigV4 {
    pair: string;
    exchange: string;
    dataProvider: string;
    currency: string;
}

/** Full backup payload shape as of v4. */
export interface BackupPayloadV4 extends Omit<BackupPayloadV3, 'version'> {
    version: 4;
    settings: BackupPayloadV3['settings'] & {
        pairConfigs?: PairConfigV4[];
    };
}

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

    /**
     * Transform the Zustand-persist localStorage state from version N to N+1.
     * Called by useSettingsStore's persist `migrate` function.
     * Only needed when the migration touches settings stored in localStorage.
     * Must be semantically equivalent to the settings portion of upgradePayload.
     */
    upgradeLocalStorage?: (state: Record<string, any>) => Record<string, any>;
}

// ---------------------------------------------------------------------------
// Migration registry
// ---------------------------------------------------------------------------
// Key   = source version (being upgraded FROM).
// Value = migration that produces source + 1.

export const MIGRATIONS: Record<number, Migration> = {

    // v1 → v2
    1: {
        description: 'Backfill Position.type (→ PRIMARY) and Transaction.orderId for numeric-id records',
        upgradePayload: (p): BackupPayloadV2 => ({
            ...(p as BackupPayloadV1),
            version: 2,
            positions: (p.positions as PositionV1[]).map(pos => ({
                ...pos,
                type: pos.type ?? 'PRIMARY',
            })),
            transactions: (p.transactions as TransactionV1[]).map(t => ({
                ...t,
                orderId: t.orderId ?? (/^\d{8,}$/.test(t.id) ? t.id : undefined),
            })),
        }),
        upgradeIdb: async (tx) => {
            await tx.table('positions').toCollection().modify((pos: PositionV1) => {
                if (!pos.type) pos.type = 'PRIMARY';
            });
            await tx.table('transactions').toCollection().modify((t: TransactionV1) => {
                if (!t.orderId && /^\d{8,}$/.test(t.id)) t.orderId = t.id;
            });
        },
    },

    // v2 → v3
    2: {
        description: 'Add funds table; add optional fundId to positions (no backfill needed)',

        upgradePayload: (p): BackupPayloadV3 => ({
            ...(p as BackupPayloadV2),
            version: 3,
            funds: (p as any).funds ?? [],
            // positions are structurally compatible; fundId is optional so no map needed
        }),
        upgradeIdb: async (_tx) => {
            // funds table is created by .stores() in db.ts
            // Position.fundId is optional — no existing records need modification
        },
    },

    // v3 → v4
    3: {
        description: 'Rename pairConfigs.dataSource → dataProvider; map stock exchanges to Yahoo Finance',
        upgradePayload: (p): BackupPayloadV4 => {
            const rawConfigs = (p.settings as any).pairConfigs as PairConfigV3[] | undefined;
            return {
                ...(p as BackupPayloadV3),
                version: 4,
                settings: {
                    ...p.settings,
                    ...(rawConfigs !== undefined && {
                        pairConfigs: rawConfigs.map(({ dataSource, ...rest }) => ({
                            ...rest,
                            dataProvider: STOCK_EXCHANGES.has(dataSource) ? 'Yahoo Finance' : dataSource,
                        })),
                    }),
                },
            };
        },
        upgradeIdb: async (_tx) => {
            // pairConfigs lives in localStorage via Zustand persist, not in IndexedDB
        },
        upgradeLocalStorage: (state) => {
            const configs = state.pairConfigs as Array<{
                pair: string; exchange: string; dataSource?: string; dataProvider?: string; currency: string;
            }> | undefined;
            if (!configs) return state;
            return {
                ...state,
                pairConfigs: configs.map(({ dataSource, ...rest }) => ({
                    ...rest,
                    dataProvider: rest.dataProvider ?? (STOCK_EXCHANGES.has(dataSource ?? '') ? 'Yahoo Finance' : (dataSource ?? rest.exchange)),
                })),
            };
        },
    },
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
