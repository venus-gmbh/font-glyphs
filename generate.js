import fs from "fs";
import path from "path";
import fontnik from "fontnik";
import glyphCompose from "@mapbox/glyph-pbf-composite";

const DEBUG = false;
let sizeSumTotal = 0;

const outputDir = '_output';
const process = [];
const processed = [];

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

// read font dirs in current dir
for (const dir of fs.readdirSync('.')) {
    // check if it is a dir
    if (!fs.lstatSync(dir).isDirectory())
        continue;

    // ignore files that start with a _
    if (dir.startsWith('_'))
        continue;

    let fonts = [];

    try {
        // if there is no font-glyphs.json this throws a exception
        fonts = require(path.resolve(__dirname, dir, 'font-glyphs.json'));
        fonts.forEach(function (font) {
            font.sources = font.sources.filter(function (f) {
                // skip sources starting with '//' -- these are "commented"
                return f.indexOf('//') === -1;
            });
        });
    } catch (e) {
        fonts = [];

        fs.readdirSync(dir).forEach(function (file) {
            if (path.extname(file) === '.ttf' || path.extname(file) === '.otf') {
                // compatible font name generation with genfontgl
                fonts.push({
                    name: path.basename(file).slice(0, -4).replace('-', '').replace(/([A-Z])([A-Z])([a-z])|([a-z])([A-Z])/g, '$1$4 $2$3$5'),
                    sources: [
                        path.basename(file)
                    ]
                });
            }
        });
    }

    if (!fonts || fonts.length === 0)
        continue;

    process.push({
        dir,
        fonts
    });
}

const doFonts = function (dir, fonts) {
    const makeGlyphs = function (config) {
        let sourceFonts = {};
        const folderName = outputDir + '/' + config.name;

        config.sources.forEach(function (sourceName) {
            if (!sourceFonts[sourceName]) {
                try {
                    sourceFonts[sourceName] = fs.readFileSync(dir + '/' + sourceName);
                } catch (e) {
                }
            }
        });

        if (!fs.existsSync(folderName)) {
            fs.mkdirSync(folderName);
        }

        let sizeSum = 0;
        const histogram = new Array(256);

        const doRange = function (start, end) {
            return Promise.all(config.sources.map(function (sourceName) {
                const source = sourceFonts[sourceName];
                if (!source) {
                    console.log('[%s] Source "%s" not found', config.name, sourceName);
                    return Promise.resolve();
                }

                return new Promise(function (resolve, reject) {
                    fontnik.range({
                        font: source,
                        start: start,
                        end: end
                    }, function (err, data) {
                        if (err) {
                            reject();
                        } else {
                            resolve(data);
                        }
                    });
                });
            })).then(function (results) {
                results = results.filter(function (r) {
                    return !!r;
                });
                const combined = glyphCompose.combine(results);
                const size = combined.length;
                sizeSum += size;
                histogram[start / 256] = size;
                if (DEBUG) {
                    console.log('[%s] Range %s-%s size %s B', config.name, start, end, size);
                }
                fs.writeFileSync(folderName + '/' + start + '-' + end + '.pbf', combined);
            });
        };

        const ranges = [];
        for (let i = 0; i < 65536; (i = i + 256)) {
            ranges.push([i, Math.min(i + 255, 65535)]);
        }

        console.log('[%s]', config.name);
        processed.push(config.name);

        let fontPromise;
        if (DEBUG) {
            return ranges.reduce(function (p, range) {
                    return p.then(function () {
                        return doRange(range[0], range[1]);
                    });
                }, Promise.resolve()
            );
        } else {
            fontPromise = Promise.all(ranges.map(function (range) {
                return doRange(range[0], range[1]);
            }));
        }
        return fontPromise.then(function () {
            console.log(' Size histo [kB]: %s', histogram.map(function (v) {
                return v > 512 ? Math.round(v / 1024) : '';
            }).join('|'));
            console.log(' Total size %s B', sizeSum);
            sizeSumTotal += sizeSum;
        });
    };

    // would be much faster in parallel, but this is better for logging
    return fonts.reduce(function (p, font) {
            return p.then(function () {
                return makeGlyphs(font);
            });
        }, Promise.resolve()
    );
};

// process font-glyphs
for (const fontEntry of process) {
    console.log("Processing directory [%s]", fontEntry.dir);
    await doFonts(fontEntry.dir, fontEntry.fonts);
}

console.log('Finished, total size %s B', sizeSumTotal);
fs.writeFileSync("./_output/fonts.json", JSON.stringify(processed));
