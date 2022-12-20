# Open Font Glyphs for GL Styles
This tool is based on the https://github.com/openmaptiles/fonts Project

This project packages the most common free fonts with
[fontnik](https://github.com/mapbox/fontnik) so you don't have to
worry about [SDL](https://www.mapbox.com/blog/text-signed-distance-fields/)
and [gzipped PBFs](https://github.com/mapbox/mapbox-gl-js/issues/830).

## Font Families
* Noto Sans (patched by Klokan Technologies)
* Open Sans
* PT Sans
* Roboto
* Metropolis
* Hubot Sans

## Package the Fonts

Install required packages:

```
npm install
```

Generate fonts:

```
node ./generate.js
```
The PBFs will created be in the `_output` directory.