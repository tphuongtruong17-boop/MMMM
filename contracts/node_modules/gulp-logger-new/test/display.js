import { createRequire } from 'module';
import { runOptionsTest } from './common.js';

const require = createRequire(import.meta.url);

const test = require('colored-tape');

test('display:default', (t) => {
    runOptionsTest(t, {});
});

test('display:relative', (t) => {
    runOptionsTest(t, {
        display: 'rel',
    });
});

test('display:absolute', (t) => {
    runOptionsTest(t, {
        display: 'abs',
    });
});

test('display:filename', (t) => {
    runOptionsTest(t, {
        display: 'name',
    });
});
