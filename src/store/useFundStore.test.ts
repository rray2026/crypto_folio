import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../lib/db';
import { useFundStore } from './useFundStore';
import { usePositionStore } from './usePositionStore';

describe('useFundStore', () => {

    beforeEach(async () => {
        await db.funds.clear();
        await db.positions.clear();
    });

    it('createFund adds a fund to the DB and returns an id', async () => {
        const { createFund } = useFundStore.getState();
        const id = await createFund({
            name: 'Test Fund',
            initialAmount: 10000,
            initialShares: 100,
            currency: 'USDT',
            status: 'ACTIVE',
        });

        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);

        const fund = await db.funds.get(id);
        expect(fund).toBeDefined();
        expect(fund?.name).toBe('Test Fund');
        expect(fund?.initialAmount).toBe(10000);
        expect(fund?.initialShares).toBe(100);
        expect(typeof fund?.createdAt).toBe('number');
    });

    it('updateFund updates fund fields in the DB', async () => {
        const { createFund, updateFund } = useFundStore.getState();
        const id = await createFund({
            name: 'Fund A',
            initialAmount: 5000,
            initialShares: 50,
            currency: 'USDT',
            status: 'ACTIVE',
        });

        await updateFund(id, { name: 'Fund A Renamed', status: 'CLOSED' });

        const fund = await db.funds.get(id);
        expect(fund?.name).toBe('Fund A Renamed');
        expect(fund?.status).toBe('CLOSED');
        // unmodified fields remain intact
        expect(fund?.initialAmount).toBe(5000);
    });

    it('deleteFund removes the fund from the DB', async () => {
        const { createFund, deleteFund } = useFundStore.getState();
        const id = await createFund({
            name: 'Fund To Delete',
            initialAmount: 1000,
            initialShares: 10,
            currency: 'USDT',
            status: 'ACTIVE',
        });

        await deleteFund(id);

        expect(await db.funds.get(id)).toBeUndefined();
    });

    it('deleteFund clears fundId from all positions that belonged to it', async () => {
        const { createFund, deleteFund } = useFundStore.getState();
        const { createPosition } = usePositionStore.getState();

        const fundId = await createFund({
            name: 'Fund With Positions',
            initialAmount: 10000,
            initialShares: 100,
            currency: 'USDT',
            status: 'ACTIVE',
        });

        // Assign two positions to the fund directly via DB
        const posId1 = await createPosition({ symbol: 'BTC/USDT', startDate: Date.now() });
        const posId2 = await createPosition({ symbol: 'ETH/USDT', startDate: Date.now() });
        await db.positions.update(posId1, { fundId });
        await db.positions.update(posId2, { fundId });

        await deleteFund(fundId);

        expect(await db.funds.get(fundId)).toBeUndefined();
        expect((await db.positions.get(posId1))?.fundId).toBeUndefined();
        expect((await db.positions.get(posId2))?.fundId).toBeUndefined();
    });

    it('deleteFund does not affect positions belonging to other funds', async () => {
        const { createFund, deleteFund } = useFundStore.getState();
        const { createPosition } = usePositionStore.getState();

        const fundIdA = await createFund({ name: 'Fund A', initialAmount: 1000, initialShares: 10, currency: 'USDT', status: 'ACTIVE' });
        const fundIdB = await createFund({ name: 'Fund B', initialAmount: 2000, initialShares: 20, currency: 'USDT', status: 'ACTIVE' });

        const posId = await createPosition({ symbol: 'SOL/USDT', startDate: Date.now() });
        await db.positions.update(posId, { fundId: fundIdB });

        await deleteFund(fundIdA);

        expect((await db.positions.get(posId))?.fundId).toBe(fundIdB);
    });

    it('assignPositionToFund sets fundId on the position', async () => {
        const { createFund, assignPositionToFund } = useFundStore.getState();
        const { createPosition } = usePositionStore.getState();

        const fundId = await createFund({ name: 'Fund B', initialAmount: 2000, initialShares: 20, currency: 'USDT', status: 'ACTIVE' });
        const posId = await createPosition({ symbol: 'ETH/USDT', startDate: Date.now() });

        await assignPositionToFund(posId, fundId);

        const pos = await db.positions.get(posId);
        expect(pos?.fundId).toBe(fundId);
    });

    it('unassignPosition clears fundId from the position', async () => {
        const { createFund, assignPositionToFund, unassignPosition } = useFundStore.getState();
        const { createPosition } = usePositionStore.getState();

        const fundId = await createFund({ name: 'Fund C', initialAmount: 3000, initialShares: 30, currency: 'USDT', status: 'ACTIVE' });
        const posId = await createPosition({ symbol: 'SOL/USDT', startDate: Date.now() });

        await assignPositionToFund(posId, fundId);
        expect((await db.positions.get(posId))?.fundId).toBe(fundId);

        await unassignPosition(posId);
        expect((await db.positions.get(posId))?.fundId).toBeUndefined();
    });
});
