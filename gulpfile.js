const gulp = require('gulp');
const zipUp = require('gulp-zip');
const webpack = require('webpack')
const webpackConfig = require('./webpack.config.js')
const slugify = require('slugify')

/**
 * Builds the assets using webpack
 * @returns {Promise}
 */
function assets() {
    return new Promise((resolve, reject) => {
        webpack(webpackConfig, (err, stats) => {
            if (err) {
                return reject(err)
            }
            if (stats.hasErrors()) {
                return reject(new Error(stats.compilation.errors.join('\n')))
            }
            resolve()
        })
    })
}
exports.build = gulp.series(assets)

/**
 * converts the dist folder into a package ready for upload
 */
function package(){
    const manifest = require('./dist/manifest.json');
    const version = manifest.version;
    const name = slugify(manifest.name, {lower: true, strict: true});
    const zipName = name + '-v' + version;

    return gulp.src('dist/**').pipe(zipUp(zipName + '.zip')).pipe(gulp.dest('package'));
}
exports.package = gulp.series(assets, package)
