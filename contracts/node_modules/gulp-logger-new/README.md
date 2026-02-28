# gulp-logger-new

The es6 version of [gulp-logger](https://www.npmjs.com/package/gulp-logger). Compatible with gulp v5.

A logger plugin for [gulp](http://gulpjs.com/) that logs stream stages, transformations, and progress.

## Installation

```bash
$ npm install gulp-logger-new --save
```

## Basic Usage

Below is an example of using `gulp-logger-new` alongside `gulp-gzip` to log stages in a Gulp task, using ES6 syntax.

```javascript
import gulp from 'gulp';
import gzip from 'gulp-gzip';
import logger from 'gulp-logger-new';

gulp.task('gzip', () => {
    return gulp.src('**/*.js')
        .pipe(logger({
            before: 'Starting Gzip...',
            after: 'Gzipping complete!',
            extname: '.js.gz',
            showChange: true
        }))
        .pipe(gzip());
});
```

### Example Folder Structure

Given a folder structure like this:

```text
files-to-stream/
    ├── baz/
    │   ├── file.js
    │   └── wat.js
    ├── foo.js
    ├── bar.js
    └── derp.js
```

The logger output would look like this:

![Logger Output](http://i.imgur.com/NvKNwAY.png)

## Options

Customize logging behavior with the following options:

- ### `before` *String*
  Message displayed before the processing starts.

- ### `after` *String*
  Message displayed after the processing ends.

- ### `beforeEach` *String*
  Message displayed before each file in the stream.

- ### `afterEach` *String*
  Message displayed after each file in the stream.

- ### `prefix` *String*
  Adds a constant prefix to each filename.

- ### `suffix` *String*
  Adds a constant suffix to each filename.

- ### `extname` *String*
  Sets a new extension for each filename.

- ### `basename` *String*
  Sets a new basename for each filename.

- ### `dest` *String*
  Sets a constant destination path for each file in the log.

- ### `colors` *Boolean*
  Enables or disables colored output in the log.

- ### `display` *String (default: `'rel'`)*
  Specifies how to display the file path for each chunk. Options are:
    - `'rel'`: Relative path
    - `'abs'`: Absolute path
    - `'name'`: Filename only

## Additional Features

- **`showChange`**: When set to `true`, displays path changes (such as renaming or destination changes) for each file.
