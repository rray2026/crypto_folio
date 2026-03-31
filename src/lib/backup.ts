import { db, DB_VERSION } from './db';
import { migratePayload } from './migrations';
import { useSettingsStore } from '@/store/useSettingsStore';
import type { PairConfig } from '@/store/useSettingsStore';

export interface BackupPayload {
    version: number;
    timestamp: number;
    appName: string;
    transactions: any[];
    positions: any[];
    funds: any[];
    settings: {
        predefinedPairs: string[];
        pairConfigs?: PairConfig[];
        dashboardTimeRange: string;
        theme: string;
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
        const settingsState = useSettingsStore.getState();

        const payload: BackupPayload = {
            version: DB_VERSION,
            timestamp: Date.now(),
            appName: 'CryptoFolio',
            transactions,
            positions,
            funds,
            settings: {
                predefinedPairs: settingsState.predefinedPairs,
                pairConfigs: settingsState.pairConfigs,
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
        a.download = `cryptofolio-backup-${dateStr}.json`;
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
                if (raw.appName !== 'CryptoFolio') {
                    throw new Error("Invalid backup file. This file does not appear to belong to CryptoFolio.");
                }

                // Validate version field exists
                if (typeof raw.version !== 'number') {
                    throw new Error("Invalid backup file: missing or non-numeric version field.");
                }

                // Reject backups created by a newer version of the app
                if (raw.version > DB_VERSION) {
                    throw new Error(
                        `This backup was created with a newer version of CryptoFolio (backup v${raw.version}, app v${DB_VERSION}). ` +
                        `Please update the app before importing.`
                    );
                }

                // Migrate older backups up to current version
                const payload = raw.version < DB_VERSION
                    ? migratePayload(raw, DB_VERSION) as BackupPayload
                    : raw;

                if (!Array.isArray(payload.transactions) || !Array.isArray(payload.positions)) {
                    throw new Error("Malformed backup properties. Missing Transactions or Positions arrays.");
                }

                // Normalise funds (may be absent in pre-v3 backups that were already migrated)
                if (!Array.isArray(payload.funds)) payload.funds = [];

                // 1. Clear database
                await db.transactions.clear();
                await db.positions.clear();
                await db.funds.clear();

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

                // 3. Hydrate settings seamlessly if properties exist
                if (payload.settings) {
                    const store = useSettingsStore.getState();
                    if (payload.settings.predefinedPairs !== undefined) {
                        useSettingsStore.setState({ predefinedPairs: payload.settings.predefinedPairs });
                    }
                    if (payload.settings.pairConfigs !== undefined) {
                        useSettingsStore.setState({ pairConfigs: payload.settings.pairConfigs });
                    } else if (payload.settings.predefinedPairs !== undefined) {
                        // Derive pairConfigs from predefinedPairs for older backups
                        useSettingsStore.setState({
                            pairConfigs: payload.settings.predefinedPairs.map(p => ({ pair: p, exchange: 'Binance' })),
                        });
                    }
                    if (payload.settings.dashboardTimeRange !== undefined) {
                        store.setDashboardTimeRange(payload.settings.dashboardTimeRange as any);
                    }
                    if (payload.settings.theme !== undefined) {
                        store.setTheme(payload.settings.theme as any);
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
