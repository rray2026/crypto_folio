import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('utils', () => {
    describe('cn', () => {
        it('merges tailwind classes correctly', () => {
            expect(cn('px-2', 'py-2')).toBe('px-2 py-2');
            expect(cn('px-2', 'px-4')).toBe('px-4'); // Tailwind merge logic
            expect(cn('px-2', false && 'py-2', 'm-1')).toBe('px-2 m-1');
        });
    });
});
