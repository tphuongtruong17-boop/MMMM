import path from 'path';
import chalk from 'chalk';

class Utils {
    constructor() {
        this.colorsEnabled = true;
    }

    getRelativePath(filePath) {
        return path.relative(process.cwd(), filePath);
    }

    colorTrans(message, color) {
        if (this.colorsEnabled) {
            return chalk[color](message);
        }
        return message;
    }

    getDisplayPath(filePath, display) {
        switch (display) {
            case 'name':
                return '';
            case 'abs':
                return path.dirname(filePath) + '/';
            case 'rel':
            default:
                return path.dirname(this.getRelativePath(filePath)) + '/';
        }
    }

    setColorsEnabled(value) {
        this.colorsEnabled = value;
    }
}

const instance = new Utils();

export default instance;
