import 'babel-register';
import 'babel-polyfill';
import fs from 'fs';
import path from 'path';
import Zip from 'jszip';

export const addCards = (apkg, list) => list.forEach(({front, back}) => apkg.addCard(front, back));

export  function unzipDeckToDir(pathToDeck, pathToUnzipTo) {
    !fs.existsSync(pathToUnzipTo) && fs.mkdirSync(pathToUnzipTo);

    const zipContent = fs.readFileSync(pathToDeck);
    const zip = new Zip();
    return zip
            .loadAsync(zipContent, { createFolders: true })
            .then(() => Promise.all(Object.keys(zip.files).map(i => {
                        const file = zip.files[i];
                        let filePath = path.join(pathToUnzipTo, file.name);
                        return file
                            .async('nodebuffer')
                            .then((data) => fs.writeFileSync(filePath, data))
                    })));
}