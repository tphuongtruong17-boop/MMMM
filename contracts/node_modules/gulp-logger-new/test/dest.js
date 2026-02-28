import { createRequire } from 'module';
import { runOptionsTest } from './common.js';

const require = createRequire(import.meta.url);

const test = require('colored-tape');

test('dest:relative', (t) => {
    runOptionsTest(t, {
        dest: 'new/location',
    });
});

test('dest:absolute', (t) => {
    runOptionsTest(t, {
        display: 'abs',
        dest: 'new/location',
    });
});

test('dest:filename', (t) => {
    runOptionsTest(t, {
        display: 'name',
        dest: 'new/location',
    });
});
