'use strict';

const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './index.js',
  output: {
    path: __dirname,
    filename: 'bundle.js'
  },
  node: {
    fs: 'empty'
  },
  plugins: [
    new CopyPlugin([
      { from: require.resolve('sql.js/dist/sql-wasm.wasm') },
    ]),
  ],
};
