import { createRequire } from 'module';
import { runOptionsTest } from './common.js';

const require = createRequire(import.meta.url);

const test = require('colored-tape');

test('before', (t) => {
    runOptionsTest(t, {
        before: 'Starting...',
    });
});
