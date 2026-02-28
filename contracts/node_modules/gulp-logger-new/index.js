import through from "through2";
import log from "fancy-log";
import utils from "./lib/utils.js";
import processFilePath from "./lib/process-file-path.js";
import processFunction from "./lib/process-function.js";

const GulpLogger = (fnOpts, opts) => {
    const options = typeof fnOpts === "object" ? fnOpts : opts;
    let beforeComplete = false;
    let afterComplete = false;

    if (options) {
        utils.setColorsEnabled(typeof options.colors !== "undefined" ? options.colors : true);
    }

    function loggerEndHandler(flushCallback) {
        if (options && options.after && !afterComplete) {
            log(utils.colorTrans(options.after, "cyan"));
            afterComplete = true;
        }
        flushCallback();
    }

    return through.obj((file, ext, streamCallback) => {
        const filePath = file.path;

        if (options && options.before && !beforeComplete) {
            log(utils.colorTrans(options.before, "cyan"));
            beforeComplete = true;
        }

        if (typeof fnOpts === "function") {
            processFunction(filePath, fnOpts, opts);
        } else if (typeof fnOpts === "object") {
            processFilePath(filePath, fnOpts);
        } else {
            log(utils.getRelativePath(filePath));
        }

        streamCallback(null, file);
    }, loggerEndHandler, undefined);
};

export default GulpLogger;
