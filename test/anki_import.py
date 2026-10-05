"""Exercise APKG imports with the real Anki backend; no GUI or existing collection."""
from pathlib import Path
from tempfile import TemporaryDirectory
import json
import sqlite3
import zipfile

from anki.buildinfo import version
from anki.collection import Collection
from anki.import_export_pb2 import ImportAnkiPackageRequest
from anki.lang import set_lang
from anki.utils import field_checksum

set_lang('en')
fixtures = Path('.tmp/anki').resolve()

# Check our stored checksums against Anki before the importer can normalize them.
with zipfile.ZipFile(fixtures / 'first.apkg') as archive:
    db = sqlite3.connect(':memory:')
    db.deserialize(archive.read('collection.anki2'))
    for fields, checksum in db.execute('SELECT flds, csum FROM notes'):
        assert checksum == field_checksum(fields.split('\x1f')[0]), fields
    db.close()

with TemporaryDirectory(prefix='anki-apkg-export-') as directory:
    col = Collection(str(Path(directory) / 'collection.anki2'))
    try:
        first = col.import_anki_package(ImportAnkiPackageRequest(package_path=str(fixtures / 'first.apkg')))
        assert col.note_count() == 3, first
        assert col.card_count() == 6, first
        assert sorted(col.db.list('SELECT ord FROM cards JOIN notes ON cards.nid = notes.id WHERE flds LIKE ?', 'The capital%')) == [0, 2]
        assert col.db.scalar('SELECT count(*) FROM cards WHERE did IN (SELECT id FROM decks WHERE name LIKE ?)', 'Languages\x1fJapanese%') == 4
        assert (Path(col.media.dir()) / 'anki.png').read_bytes() == Path('test/fixtures/anki.png').read_bytes()
        assert (Path(col.media.dir()) / 'test.mp3').read_bytes() == bytes([0, 1, 2, 255])
        card_id = col.db.scalar('SELECT cards.id FROM cards JOIN notes ON cards.nid = notes.id WHERE flds LIKE ? LIMIT 1', '東京%')
        col.db.execute('UPDATE cards SET reps = 7, ivl = 12, type = 2, queue = 2 WHERE id = ?', card_id)
        updated = col.import_anki_package(ImportAnkiPackageRequest(package_path=str(fixtures / 'updated.apkg')))
        assert col.note_count() == 3, updated
        assert col.card_count() == 6, updated
        assert col.db.scalar('SELECT flds FROM notes WHERE flds LIKE ?', '東京%') == '東京 (Tokyo)\x1fTokyo'
        assert col.db.scalar('SELECT reps FROM cards WHERE id = ?', card_id) == 7
        col.import_anki_package(ImportAnkiPackageRequest(package_path=str(fixtures / 'updated.apkg')))
        assert col.note_count() == 3
        assert col.card_count() == 6
        print(json.dumps({'anki': version, 'notes': col.note_count(), 'cards': col.card_count(),
                          'media': 'ok', 'reimport': 'ok', 'review_history': 'preserved'}))
    finally:
        col.close()
