import { createRequire } from 'module';
import { runOptionsTest } from './common.js';

const require = createRequire(import.meta.url);

const test = require('colored-tape');

test('combination:before, after, beforeEach, afterEach', (t) => {
    runOptionsTest(t, {
        before: 'beforeTest!',
        after: 'afterTest!',
        beforeEach: 'beforeEachTest!',
        afterEach: 'afterEachTest!',
    });
});

test('combination:extname, basename, prefix, suffix', (t) => {
    runOptionsTest(t, {
        extname: 'extnameTest!',
        basename: 'basenameTest!',
        prefix: 'prefixTest!',
        suffix: 'suffixTest!',
    });
});

test('combination:readme options', (t) => {
    runOptionsTest(t, {
        before: 'Starting Gzip...',
        after: 'Gzipping complete!',
        extname: '.js.gz',
        showChange: true,
    });
});
