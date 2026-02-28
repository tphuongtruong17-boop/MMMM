import path from 'path';
import utils from './utils.js';

export default function (filePath, fn, opts = {}) {
    const display = opts.display || 'rel';
    const newPath = utils.getDisplayPath(filePath, display) + path.basename(filePath);

    fn(newPath);
}
