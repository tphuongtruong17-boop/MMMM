import { createRequire } from 'module';
import { runOptionsTest } from './common.js';

const require = createRequire(import.meta.url);

const test = require('colored-tape');

test('extname', (t) => {
    runOptionsTest(t, {
        extname: '.js.gz',
    });
});
