const sha1 = require('sha1');

export const checksum = str => parseInt(sha1(str).substr(0, 8), 16);