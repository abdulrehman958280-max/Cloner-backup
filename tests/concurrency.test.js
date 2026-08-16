import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createConcurrencyLimiter,
    mapWithConcurrency
} from '../services/reliability/index.js';

test('createConcurrencyLimiter limits max active promises', async () => {
    const limiter = createConcurrencyLimiter(2);
    let active = 0;
    let maxActive = 0;

    const tasks = Array.from({ length: 6 }, async (_, i) => {
        return limiter(async () => {
            active++;
            maxActive = Math.max(maxActive, active);
            await new Promise(r => setTimeout(r, 30));
            active--;
            return i;
        });
    });

    const results = await Promise.all(tasks);
    assert.deepEqual(results, [0, 1, 2, 3, 4, 5]);
    assert.ok(maxActive <= 2, `maxActive was ${maxActive}`);
});

test('mapWithConcurrency processes items and reports progress', async () => {
    const items = [1, 2, 3, 4, 5];
    const progressCalls = [];

    const results = await mapWithConcurrency(items, 2, async (item) => {
        return item * 10;
    }, {
        onProgress: (current, total, item) => {
            progressCalls.push({ current, total, item });
        }
    });

    assert.equal(results.length, 5);
    assert.equal(results[0].value, 10);
    assert.equal(results[4].value, 50);
    assert.equal(progressCalls.length, 5);
    assert.equal(progressCalls[4].current, 5);
});
