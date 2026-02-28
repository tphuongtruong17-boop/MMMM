import { createRequire } from 'module';
import { runFunctionTest } from './common.js';

const require = createRequire(import.meta.url);

const test = require('colored-tape');

test('function:default', (t) => {
    runFunctionTest(t, {});
});

test('function:relative', (t) => {
    runFunctionTest(t, {
        display: 'rel',
    });
});

test('function:absolute', (t) => {
    runFunctionTest(t, {
        display: 'abs',
    });
});

test('function:filename', (t) => {
    runFunctionTest(t, {
        display: 'name',
    });
});

test('function:before', (t) => {
    runFunctionTest(t, {
        before: 'functionBeforeTest!',
    });
});

test('function:after', (t) => {
    runFunctionTest(t, {
        after: 'functionAfterTest!',
    });
});
