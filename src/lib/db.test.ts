import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
    DB_NAME,
    DB_VERSION,
    getActualDbVersion,
    getDbCompatibilityStatus,
    checkDbCompatibility,
} from './db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Open (or upgrade) the native IDB to an exact version. */
function openNativeDb(idb: IDBFactory, version: number): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = idb.open(DB_NAME, version);
        req.onupgradeneeded = () => { /* allow upgrade, no stores needed */ };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

/**
 * Run a block against a temporary, isolated IDBFactory so tests cannot
 * pollute each other's DB state.
 */
function withFreshIdb(fn: (idb: IDBFactory) => void) {
    const saved = globalThis.indexedDB;
    const fresh = new IDBFactory();
    return {
        beforeAll: () => { globalThis.indexedDB = fresh; },
        run: () => fn(fresh),
        afterAll: () => { globalThis.indexedDB = saved; },
    };
}

// ---------------------------------------------------------------------------
// getDbCompatibilityStatus — pure unit tests, no I/O
// ---------------------------------------------------------------------------

describe('getDbCompatibilityStatus', () => {
    it('returns ok when actual version equals DB_VERSION', () => {
        expect(getDbCompatibilityStatus(DB_VERSION)).toBe('ok');
    });

    it('returns ok when actual is 0 (DB does not exist yet)', () => {
        expect(getDbCompatibilityStatus(0)).toBe('ok');
    });

    it('returns incompatible when actual version exceeds DB_VERSION', () => {
        expect(getDbCompatibilityStatus(DB_VERSION + 1)).toBe('incompatible');
        expect(getDbCompatibilityStatus(DB_VERSION + 999)).toBe('incompatible');
    });

    it('returns needs-upgrade when actual version is between 1 and DB_VERSION - 1', () => {
        // Real IDB versions start at 1; version 0 means "no DB" → 'ok'.
        // This branch is reachable only when DB_VERSION > 1.
        if (DB_VERSION > 1) {
            expect(getDbCompatibilityStatus(1)).toBe('needs-upgrade');
            expect(getDbCompatibilityStatus(DB_VERSION - 1)).toBe('needs-upgrade');
        } else {
            // DB_VERSION === 1: no integer in (0, 1) exists.
            // Verify the comparison is still logically correct for hypothetical values.
            // (Branch will be exercised automatically once DB_VERSION is incremented.)
            expect(getDbCompatibilityStatus(0)).toBe('ok');        // below → 0 means "no DB"
            expect(getDbCompatibilityStatus(DB_VERSION)).toBe('ok'); // equal → ok
        }
    });
});

// ---------------------------------------------------------------------------
// getActualDbVersion — reads real (fake) IndexedDB
// Each sub-group uses an isolated IDBFactory to prevent state leakage.
// ---------------------------------------------------------------------------

describe('getActualDbVersion', () => {
    describe('when DB does not exist yet', () => {
        const ctx = withFreshIdb(() => {});
        beforeAll(ctx.beforeAll);
        afterAll(ctx.afterAll);

        it('returns 1 (IDB creates it at version 1 on first open)', async () => {
            const version = await getActualDbVersion();
            // IDB auto-creates the DB at version 1 when it does not exist
            expect(version).toBe(1);
        });
    });

    describe('when DB is at the current version', () => {
        const ctx = withFreshIdb(async (idb) => {
            const db = await openNativeDb(idb, DB_VERSION);
            db.close();
        });
        beforeAll(ctx.beforeAll);
        beforeAll(ctx.run as any);
        afterAll(ctx.afterAll);

        it('reports the correct version', async () => {
            const version = await getActualDbVersion();
            expect(version).toBe(DB_VERSION);
        });
    });

    describe('when DB has been upgraded to a higher version', () => {
        const higherVersion = DB_VERSION + 50;
        const ctx = withFreshIdb(async (idb) => {
            const db = await openNativeDb(idb, higherVersion);
            db.close();
        });
        beforeAll(ctx.beforeAll);
        beforeAll(ctx.run as any);
        afterAll(ctx.afterAll);

        it('reports the higher version', async () => {
            const version = await getActualDbVersion();
            expect(version).toBe(higherVersion);
        });
    });
});

// ---------------------------------------------------------------------------
// checkDbCompatibility — end-to-end with isolated fake IndexedDB
// ---------------------------------------------------------------------------

describe('checkDbCompatibility', () => {
    describe('fresh install (DB does not exist)', () => {
        const ctx = withFreshIdb(() => {});
        beforeAll(ctx.beforeAll);
        afterAll(ctx.afterAll);

        it('returns ok', async () => {
            expect(await checkDbCompatibility()).toBe('ok');
        });
    });

    describe('DB is at the current version', () => {
        const ctx = withFreshIdb(async (idb) => {
            const db = await openNativeDb(idb, DB_VERSION);
            db.close();
        });
        beforeAll(ctx.beforeAll);
        beforeAll(ctx.run as any);
        afterAll(ctx.afterAll);

        it('returns ok', async () => {
            expect(await checkDbCompatibility()).toBe('ok');
        });
    });

    describe('DB is ahead of the code — app is too old (incompatible)', () => {
        // Simulates a user who ran a newer version of the app and then rolled back.
        const futureVersion = DB_VERSION + 100;
        const ctx = withFreshIdb(async (idb) => {
            const db = await openNativeDb(idb, futureVersion);
            db.close();
        });
        beforeAll(ctx.beforeAll);
        beforeAll(ctx.run as any);
        afterAll(ctx.afterAll);

        it('returns incompatible', async () => {
            expect(await checkDbCompatibility()).toBe('incompatible');
        });

        it('getActualDbVersion reports a version greater than DB_VERSION', async () => {
            const actual = await getActualDbVersion();
            expect(actual).toBeGreaterThan(DB_VERSION);
        });
    });

    describe('DB needs upgrade — code is newer than stored data', () => {
        // Simulates upgrading the app (DB_VERSION bump from N to N+1).
        // Only directly testable when DB_VERSION > 1; for DB_VERSION === 1
        // we validate the detection logic via getDbCompatibilityStatus.
        it('getDbCompatibilityStatus correctly identifies needs-upgrade for any version in (0, DB_VERSION)', () => {
            if (DB_VERSION > 1) {
                // When DB_VERSION > 1 a real IDB can be at a lower-but-valid version.
                expect(getDbCompatibilityStatus(1)).toBe('needs-upgrade');
                expect(getDbCompatibilityStatus(DB_VERSION - 1)).toBe('needs-upgrade');
            } else {
                // DB_VERSION === 1: lowest possible real IDB version is 1, equal to DB_VERSION.
                // Dexie's own upgrade mechanism handles this case; document it here.
                expect(getDbCompatibilityStatus(DB_VERSION)).toBe('ok');
            }
        });
    });
});
