const sha1 = require('sha1');

export const checksum = str => parseInt(sha1(str).substr(0, 8), 16);

export const getLastItem = obj => {
  const keys = Object.keys(obj);
  const lastKey = keys[keys.length - 1];

  const item = obj[lastKey];
  delete obj[lastKey];

  return item;
};
