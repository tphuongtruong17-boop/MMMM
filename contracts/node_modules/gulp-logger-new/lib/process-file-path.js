import path from 'path';

import log from 'fancy-log';
import rename from 'rename';
import utils from './utils.js';

export default function (filePath, opts = {}) {
    const {
        display = 'rel',
        beforeEach,
        afterEach,
        prefix,
        suffix,
        extname,
        basename,
        dest,
        showChange,
    } = opts;

    let renameConfig = {};
    let filePathToProcess = [];
    let displayPath;
    let destPath;
    let oldBasename;
    let newBasename;

    displayPath = utils.getDisplayPath(filePath, display);
    destPath = dest
        ? utils.colorTrans(`${path.resolve(`/${displayPath}`, dest)}/`, 'blue')
        : displayPath;

    filePathToProcess.push(utils.colorTrans(destPath, 'gray'));

    oldBasename = path.basename(filePath);

    if (prefix) {
        renameConfig.prefix = utils.colorTrans(prefix, 'magenta');
    }

    if (suffix) {
        renameConfig.suffix = utils.colorTrans(suffix, 'magenta');
    }

    if (extname) {
        renameConfig.extname = utils.colorTrans(extname, 'magenta');
    }

    if (basename) {
        renameConfig.basename = utils.colorTrans(basename, 'magenta');
    }

    if (Object.keys(renameConfig).length) {
        newBasename = utils.colorTrans(
            path.basename(rename(filePath, renameConfig)),
            'gray'
        );
    } else {
        newBasename = utils.colorTrans(oldBasename, 'gray');
    }

    filePathToProcess.push(newBasename);
    filePathToProcess = filePathToProcess.join('');

    if (beforeEach) {
        filePathToProcess = utils.colorTrans(beforeEach, 'yellow') + filePathToProcess;
    }

    if (afterEach) {
        filePathToProcess = filePathToProcess + utils.colorTrans(afterEach, 'yellow');
    }

    if (showChange) {
        log(
            utils.colorTrans(displayPath + oldBasename, 'gray'),
            ' -> ',
            filePathToProcess
        );
    } else {
        log(filePathToProcess);
    }
}
