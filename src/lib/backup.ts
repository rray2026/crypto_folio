import { db } from './db';
import { useSettingsStore } from '@/store/useSettingsStore';

export interface BackupPayload {
    version: number;
    timestamp: number;
    appName: string;
    transactions: any[];
    positions: any[];
    settings: {
        predefinedPairs: string[];
        dashboardTimeRange: string;
        theme: string;
    };
}

export async function exportData(): Promise<void> {
    try {
        const transactions = await db.transactions.toArray();
        const positions = await db.positions.toArray();
        const settingsState = useSettingsStore.getState();

        const payload: BackupPayload = {
            version: 1,
            timestamp: Date.now(),
            appName: 'CryptoFolio',
            transactions,
            positions,
            settings: {
                predefinedPairs: settingsState.predefinedPairs,
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

export async function importData(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                if (!content) throw new Error("Empty file payload.");

                const payload = JSON.parse(content) as BackupPayload;

                // Validate schema rudimentarily
                if (payload.appName !== 'CryptoFolio') {
                    throw new Error("Invalid backup file. This file does not appear to belong to CryptoFolio.");
                }

                if (!Array.isArray(payload.transactions) || !Array.isArray(payload.positions)) {
                    throw new Error("Malformed backup properties. Missing Transactions or Positions arrays.");
                }

                // 1. Clear database
                await db.transactions.clear();
                await db.positions.clear();

                // 2. Hydrate database
                if (payload.transactions.length > 0) {
                    await db.transactions.bulkAdd(payload.transactions);
                }
                if (payload.positions.length > 0) {
                    await db.positions.bulkAdd(payload.positions);
                }

                // 3. Hydrate settings seamlessly if properties exist
                if (payload.settings) {
                    const store = useSettingsStore.getState();
                    if (payload.settings.predefinedPairs !== undefined) {
                        useSettingsStore.setState({ predefinedPairs: payload.settings.predefinedPairs });
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
