# anki-apkg-export

[![Build Status](https://travis-ci.org/ewnd9/anki-apkg-export.svg?branch=master)](https://travis-ci.org/ewnd9/anki-apkg-export)

Universal module for generating Anki's decks.

Port of the Ruby gem https://github.com/albertzak/anki2

## Install

```
$ npm install anki-apkg-export --save
```

## Usage

### server

```js
const fs = require('fs');
const AnkiExport = require('anki-apkg-export').default;

const apkg = new AnkiExport('deck-name');

apkg.addCard('card #1 front', 'card #1 back');
apkg.addCard('card #2 front', 'card #2 back');

const zip = apkg.save();

fs.writeFileSync('./output.apkg', zip, 'binary');
console.log(`Package has been generated: output.pkg`);
```

### browser

Intended to be used with [`webpack`](https://github.com/webpack/webpack)

```js
const webpack = require('webpack');

module.exports = {
  entry: './index.js',
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel'
      },
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
        APP_ENV: JSON.stringify('browser')
      },
    })
  ],
  output: {
    path: __dirname,
    filename: 'bundle.js'
  }
};
```

Required loaders:

- [`script-loader`](https://github.com/webpack/script-loader)
- [`raw-loader`](https://github.com/webpack/raw-loader)

```js
import { saveAs } from 'filesaverjs';
import AnkiExport from 'anki-apkg-export';

const apkg = new AnkiExport('deck-name');

apkg.addCard('card #1 front', 'card #1 back');
apkg.addCard('card #2 front', 'card #2 back');

const zip = apkg.save();
saveAs(zip, 'output.apkg');
```

## License

MIT © [ewnd9](http://ewnd9.com)
