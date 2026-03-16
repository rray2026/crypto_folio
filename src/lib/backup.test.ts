import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from './db';
import { useSettingsStore } from '@/store/useSettingsStore';
import { exportData, importData } from './backup';

// Mock Browser APIs
globalThis.URL.createObjectURL = vi.fn(() => 'blob:url');
globalThis.URL.revokeObjectURL = vi.fn();

class MockBlob {
    content: any;
    options: any;
    static lastInstance: MockBlob;
    constructor(content: any, options: any) {
        this.content = content;
        this.options = options;
        MockBlob.lastInstance = this;
    }
}
globalThis.Blob = MockBlob as any;

const mockReader = {
    readAsText: vi.fn(),
    onload: null as any,
    result: ''
};

class MockFileReader {
    readAsText(file: any) {
        mockReader.readAsText(file);
        setTimeout(() => {
            if (this.onload) {
                this.onload({ target: { result: mockReader.result } });
            }
        }, 0);
    }
    onload: any;
}
vi.stubGlobal('FileReader', MockFileReader);

describe('backup logic', () => {

    beforeEach(async () => {
        await db.transactions.clear();
        await db.positions.clear();
        useSettingsStore.setState({
            predefinedPairs: ['TEST/USDT'],
            theme: 'dark',
            dashboardTimeRange: 'ALL'
        });
        vi.restoreAllMocks();
    });

    describe('exportData', () => {
        it('creates a download link with the correct data payload', async () => {
            // Mock DOM APIs
            const mockLink = {
                href: '',
                download: '',
                click: vi.fn()
            };
            document.createElement = vi.fn().mockReturnValue(mockLink);
            document.body.appendChild = vi.fn();
            document.body.removeChild = vi.fn();

            await db.transactions.add({ id: 'tx1', symbol: 'BTC/USDT' } as any);
            await db.positions.add({ id: 'pos1', symbol: 'BTC/USDT' } as any);

            await exportData();

            expect(document.createElement).toHaveBeenCalledWith('a');
            expect(mockLink.download).toContain('cryptofolio-backup');
            expect(mockLink.click).toHaveBeenCalled();
            
            // Check Blob content
            const blobContent = (globalThis.Blob as any).lastInstance.content[0];
            const payload = JSON.parse(blobContent);
            
            expect(payload.appName).toBe('CryptoFolio');
            expect(payload.transactions).toHaveLength(1);
            expect(payload.positions).toHaveLength(1);
            expect(payload.settings.theme).toBe('dark');
        });
    });

    describe('importData', () => {
        it('successfully hydrides DB and settings from a valid backup file', async () => {
            const mockPayload = {
                version: 1,
                timestamp: Date.now(),
                appName: 'CryptoFolio',
                transactions: [{ id: 'new-tx', symbol: 'ETH/USDT' }],
                positions: [{ id: 'new-pos', symbol: 'ETH/USDT' }],
                settings: {
                    predefinedPairs: ['ETH/USDT'],
                    dashboardTimeRange: '1M',
                    theme: 'light'
                }
            };

            const mockFile = new File([JSON.stringify(mockPayload)], 'backup.json', { type: 'application/json' });
            mockReader.result = JSON.stringify(mockPayload);

            await importData(mockFile);

            // Verify DB
            const txCount = await db.transactions.count();
            const posCount = await db.positions.count();
            expect(txCount).toBe(1);
            expect(posCount).toBe(1);

            // Verify Settings
            const settings = useSettingsStore.getState();
            expect(settings.theme).toBe('light');
            expect(settings.dashboardTimeRange).toBe('1M');
        });

        it('throws an error if the backup file belongs to another app', async () => {
            const mockPayload = { appName: 'WrongApp' };
            const mockFile = new File([JSON.stringify(mockPayload)], 'backup.json', { type: 'application/json' });
            mockReader.result = JSON.stringify(mockPayload);

            await expect(importData(mockFile)).rejects.toThrow('Invalid backup file');
        });
    });
});
