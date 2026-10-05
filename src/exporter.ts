import sha1 from 'sha1';
import he from 'he';
import JSZip from 'jszip';
import type { Database, SqlJsStatic, SqlValue } from 'sql.js';
import { schema } from './schema.js';
import { collectionValues, createDeck, createModel } from './template.js';
import type { CardInput, CardOptions, ExportOptions, MediaData, SaveOutput } from './types.js';

export function stableId(namespace: string, value: unknown): number {
  return parseInt(sha1(JSON.stringify([namespace, value])).slice(0, 12), 16) || 2;
}

export function assertId(id: number, label: string): void {
  if (!Number.isSafeInteger(id) || id <= 1)
    throw new TypeError(`${label} must be a safe integer greater than 1`);
}

export function assertField(value: string): void {
  if (typeof value !== 'string' || /[\u0000\u001f]/u.test(value)) {
    throw new TypeError('Fields must be strings without NUL or the Anki field separator');
  }
}

// Match Anki's first-field checksum: strip markup, retain image filenames, decode entities.
function stripHtml(value: string): string {
  return he.decode(
    value
      .replace(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi, ' $1 ')
      .replace(/<!--[^]*?-->|<style\b[^]*?<\/style>|<script\b[^]*?<\/script>/gi, '')
      .replace(/<[^>]*>/g, ''),
  );
}

export class Exporter {
  readonly db: Database;
  readonly deckName: string;
  readonly topDeckId: number;
  readonly topModelId: number;
  private closed: boolean = false;
  private nextId: number = Date.now();
  private nextDue: number = 1;
  private readonly media: Map<string, MediaData | Promise<MediaData>> = new Map();

  constructor(deckName: string, options: ExportOptions & { sql: SqlJsStatic }) {
    if (typeof deckName !== 'string' || !deckName.trim())
      throw new TypeError('Deck name must not be empty');
    this.deckName = deckName;
    this.topDeckId = options.deckId ?? stableId('deck', deckName);
    this.topModelId = options.modelId ?? stableId('model', [this.topDeckId, 'Basic']);
    assertId(this.topDeckId, 'deckId');
    assertId(this.topModelId, 'modelId');
    this.db = new options.sql.Database();
    try {
      this.db.run(schema);
      this.db.run(
        'INSERT INTO col VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        collectionValues(
          createDeck(deckName, this.topDeckId),
          createModel(deckName, this.topDeckId, this.topModelId, options),
        ),
      );
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  addCard(front: string, back: string, options: CardOptions = {}): void {
    this.assertOpen();
    assertField(front);
    assertField(back);
    if (!front.trim()) throw new TypeError('Front must not be empty');
    if (
      options.noteId !== undefined &&
      !(
        (typeof options.noteId === 'string' && options.noteId.length > 0) ||
        (typeof options.noteId === 'number' && Number.isSafeInteger(options.noteId))
      )
    ) {
      throw new TypeError('noteId must be a nonempty string or a safe integer');
    }
    const guid = sha1(
      JSON.stringify([
        this.topDeckId,
        this.topModelId,
        options.noteId === undefined ? ['fields', front, back] : ['id', options.noteId],
      ]),
    );
    const existing = this.query('SELECT id FROM notes WHERE guid = ?', [guid]);
    const noteId = typeof existing.id === 'number' ? existing.id : this.nextId++;
    const mod = Math.floor(Date.now() / 1000);
    const tags = this.formatTags(options.tags);
    this.db.run('INSERT OR REPLACE INTO notes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      noteId,
      guid,
      this.topModelId,
      mod,
      -1,
      tags,
      `${front}\u001f${back}`,
      stripHtml(front),
      parseInt(sha1(stripHtml(front)).slice(0, 8), 16),
      0,
      '',
    ]);
    const card = this.query('SELECT id, due FROM cards WHERE nid = ? AND ord = 0', [noteId]);
    this.db.run(
      'INSERT OR REPLACE INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        typeof card.id === 'number' ? card.id : this.nextId++,
        noteId,
        this.topDeckId,
        0,
        mod,
        -1,
        0,
        0,
        typeof card.due === 'number' ? card.due : this.nextDue++,
        0,
        2500,
        0,
        0,
        0,
        0,
        0,
        0,
        '',
      ],
    );
  }

  addCards(cards: Iterable<CardInput>): void {
    this.assertOpen();
    const nextId = this.nextId;
    const nextDue = this.nextDue;
    this.db.run('BEGIN');
    try {
      for (const { front, back, ...options } of cards) this.addCard(front, back, options);
      this.db.run('COMMIT');
    } catch (error) {
      this.db.run('ROLLBACK');
      this.nextId = nextId;
      this.nextDue = nextDue;
      throw error;
    }
  }

  addMedia(filename: string, data: MediaData | Promise<MediaData>): void {
    this.assertOpen();
    if (
      typeof filename !== 'string' ||
      !filename.trim() ||
      /^[.]/u.test(filename) ||
      /[/\\:*?"<>|\u0000-\u001f]/u.test(filename)
    ) {
      throw new TypeError('Media filename must be a plain filename without path separators');
    }
    if (this.media.has(filename)) throw new Error(`Media filename already added: ${filename}`);
    this.media.set(filename, data);
  }

  save(): Promise<Uint8Array>;
  save<T extends JSZip.OutputType>(
    options: JSZip.JSZipGeneratorOptions<T> & { type: T },
  ): Promise<SaveOutput[T]>;
  save(
    options: JSZip.JSZipGeneratorOptions<JSZip.OutputType> = {},
  ): Promise<SaveOutput[JSZip.OutputType]> {
    this.assertOpen();
    const zip = new JSZip();
    zip.file('collection.anki2', this.db.export());
    const manifest: Record<string, string> = {};
    let index = 0;
    for (const [filename, data] of this.media) {
      const key = String(index++);
      manifest[key] = filename;
      zip.file(key, data);
    }
    zip.file('media', JSON.stringify(manifest));
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', ...options });
  }

  close(): void {
    if (this.closed) return;
    this.db.close();
    this.media.clear();
    this.closed = true;
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('Exporter is closed');
  }

  private query(sql: string, params: SqlValue[]): Record<string, SqlValue> {
    const statement = this.db.prepare(sql);
    try {
      return statement.getAsObject(params);
    } finally {
      statement.free();
    }
  }

  private formatTags(tags?: string | readonly string[]): string {
    if (tags === undefined) return '';
    const list = typeof tags === 'string' ? tags.split(/\s+/u) : tags;
    if (
      !Array.isArray(list) ||
      list.some((tag) => typeof tag !== 'string' || /[\u0000\u001f]/u.test(tag))
    ) {
      throw new TypeError('Tags must be a string or an array of strings');
    }
    const normalized = [
      ...new Set(list.map((tag) => tag.trim().replace(/\s+/gu, '_')).filter(Boolean)),
    ];
    return normalized.length ? ` ${normalized.join(' ')} ` : '';
  }
}
