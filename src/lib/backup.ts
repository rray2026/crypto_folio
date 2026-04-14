import { db, DB_VERSION } from './db';
import { migratePayload } from './migrations';
import type { Transaction, Position, Fund, Strategy } from './types';
import { useSettingsStore, inferCurrency, defaultDataProvider, inferMarket } from '@/store/useSettingsStore';
import type { PairConfig, DashboardTimeRange, Theme } from '@/store/useSettingsStore';

export interface BackupPayload {
    version: number;
    timestamp: number;
    appName: string;
    transactions: Transaction[];
    positions: Position[];
    funds: Fund[];
    strategies: Strategy[];
    settings: {
        predefinedPairs: string[];
        pairConfigs?: PairConfig[];
        enabledMarkets?: string[];
        pinnedPairs?: string[];
        dashboardTimeRange: DashboardTimeRange;
        theme: Theme;
    };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
export async function exportData(): Promise<void> {
    try {
        const transactions = await db.transactions.toArray();
        const positions = await db.positions.toArray();
        const funds = await db.funds.toArray();
        const strategies = await db.strategies.toArray();
        const settingsState = useSettingsStore.getState();

        const payload: BackupPayload = {
            version: DB_VERSION,
            timestamp: Date.now(),
            appName: 'Folio',
            transactions,
            positions,
            funds,
            strategies,
            settings: {
                predefinedPairs: settingsState.predefinedPairs,
                pairConfigs: settingsState.pairConfigs,
                enabledMarkets: settingsState.enabledMarkets,
                pinnedPairs: settingsState.pinnedPairs,
                dashboardTimeRange: settingsState.dashboardTimeRange,
                theme: settingsState.theme,
            }
        };

        const jsonString = JSON.stringify(payload, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });

        const url = URL.createObjectURL(blob);
        const dateStr = new Date().toISOString().split('T')[0];
        const a = document.createElement('a');
        a.href = url;
        a.download = `folio-backup-${dateStr}.json`;
        document.body.appendChild(a);
        a.click();

        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Failed to export complete data payload", error);
        throw error;
    }
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------
export async function importData(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                if (!content) throw new Error("Empty file payload.");

                const raw = JSON.parse(content) as BackupPayload;

                // Validate app identity
                if (raw.appName !== 'Folio' && raw.appName !== 'CryptoFolio') {
                    throw new Error("Invalid backup file. This file does not appear to belong to Folio.");
                }

                // Validate version field exists
                if (typeof raw.version !== 'number') {
                    throw new Error("Invalid backup file: missing or non-numeric version field.");
                }

                // Reject backups created by a newer version of the app
                if (raw.version > DB_VERSION) {
                    throw new Error(
                        `This backup was created with a newer version of Folio (backup v${raw.version}, app v${DB_VERSION}). ` +
                        `Please update the app before importing.`
                    );
                }

                // Migrate older backups up to current version
                const payload = raw.version < DB_VERSION
                    ? migratePayload(raw as unknown as Record<string, unknown>, DB_VERSION) as unknown as BackupPayload
                    : raw;

                if (!Array.isArray(payload.transactions) || !Array.isArray(payload.positions)) {
                    throw new Error("Malformed backup properties. Missing Transactions or Positions arrays.");
                }

                // Normalise funds and strategies (may be absent in older backups)
                if (!Array.isArray(payload.funds)) payload.funds = [];
                if (!Array.isArray(payload.strategies)) payload.strategies = [];

                // 1. Clear database
                await db.transactions.clear();
                await db.positions.clear();
                await db.funds.clear();
                await db.strategies.clear();

                // 2. Hydrate database
                if (payload.transactions.length > 0) {
                    await db.transactions.bulkAdd(payload.transactions);
                }
                if (payload.positions.length > 0) {
                    await db.positions.bulkAdd(payload.positions);
                }
                if (payload.funds.length > 0) {
                    await db.funds.bulkAdd(payload.funds);
                }
                if (payload.strategies.length > 0) {
                    await db.strategies.bulkAdd(payload.strategies);
                }

                // 3. Hydrate settings seamlessly if properties exist
                if (payload.settings) {
                    const store = useSettingsStore.getState();
                    if (payload.settings.predefinedPairs !== undefined) {
                        useSettingsStore.setState({ predefinedPairs: payload.settings.predefinedPairs });
                    }
                    if (payload.settings.pairConfigs !== undefined) {
                        // Backfill currency, dataProvider, and market for backups that predate those fields
                        useSettingsStore.setState({
                            pairConfigs: payload.settings.pairConfigs.map((c) => ({
                                ...c,
                                market: c.market ?? inferMarket(c.exchange),
                                currency: c.currency ?? inferCurrency(c.pair, c.exchange),
                                dataProvider: c.dataProvider ?? defaultDataProvider((c as unknown as Record<string, unknown>).dataSource as string ?? c.exchange),
                            })),
                        });
                    } else if (payload.settings.predefinedPairs !== undefined) {
                        // Derive pairConfigs from predefinedPairs for older backups
                        useSettingsStore.setState({
                            pairConfigs: payload.settings.predefinedPairs.map(p => ({
                                pair: p, market: 'Crypto', exchange: 'Binance', dataProvider: 'Binance', currency: inferCurrency(p, 'Binance'),
                            })),
                        });
                    }
                    if (payload.settings.enabledMarkets !== undefined) {
                        useSettingsStore.setState({ enabledMarkets: payload.settings.enabledMarkets });
                    }
                    if (payload.settings.pinnedPairs !== undefined) {
                        useSettingsStore.setState({ pinnedPairs: payload.settings.pinnedPairs });
                    }
                    if (payload.settings.dashboardTimeRange !== undefined) {
                        store.setDashboardTimeRange(payload.settings.dashboardTimeRange);
                    }
                    if (payload.settings.theme !== undefined) {
                        store.setTheme(payload.settings.theme);
                    }
                }

                resolve();
            } catch (error) {
                console.error("Failed to parse and inject JSON backup:", error);
                reject(error);
            }
        };

        reader.onerror = () => {
            reject(new Error("File Reader threw a native error during loading."));
        };

        reader.readAsText(file);
    });
}
