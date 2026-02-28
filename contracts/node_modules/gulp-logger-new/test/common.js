import gulp from 'gulp';
import logger from '../index.js';

const FILES_TO_STREAM = 'test/files-to-stream/**/*.js';

export const runOptionsTest = (t, config) => {
    t.plan(1);

    gulp.src(FILES_TO_STREAM)
        .pipe(logger(config))
        .on('data', () => {
        })
        .on('end', () => {
            t.equals(true, true);
        });
};

export const runFunctionTest = (t, config) => {
    t.plan(1);

    gulp.src(FILES_TO_STREAM)
        .pipe(logger((filePath) => {
            console.log(filePath);
        }, config))
        .on('data', () => {
        })
        .on('end', () => {
            t.equals(true, true);
        });
};
