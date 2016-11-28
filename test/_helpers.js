import 'babel-register';
import 'babel-polyfill';

import decompress from 'decompress';

export const addCards = (apkg, list) => list.forEach(({front, back}) => apkg.addCard(front, back));

export const unzipDeckToDir = (pathToDeck, pathToUnzipTo) => decompress(pathToDeck, pathToUnzipTo);