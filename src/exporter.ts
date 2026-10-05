import sha1 from 'sha1';
import he from 'he';
import JSZip from 'jszip';
import type { Database, SqlJsStatic, SqlValue } from 'sql.js';
import { schema } from './schema.js';
import { collectionValues, createDeck, createModel, defaultModel } from './template.js';
import type { AnkiDeck, AnkiModel } from './template.js';
import type {
  CardInput,
  CardOptions,
  ExportOptions,
  MediaData,
  SaveOutput,
  ModelDefinition,
  NoteFields,
  NoteInput,
} from './types.js';

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
  private decks: Map<string, AnkiDeck> = new Map();
  private models: Map<number, AnkiModel> = new Map();
  private readonly media: Map<string, MediaData | Promise<MediaData>> = new Map();

  constructor(deckName: string, options: ExportOptions & { sql: SqlJsStatic }) {
    if (typeof deckName !== 'string' || !deckName.trim())
      throw new TypeError('Deck name must not be empty');
    this.deckName = deckName;
    this.topDeckId = options.deckId ?? stableId('deck', deckName);
    const definition = defaultModel(deckName, options);
    this.topModelId =
      options.modelId ?? definition.id ?? stableId('model', [this.topDeckId, definition.name]);
    assertId(this.topDeckId, 'deckId');
    assertId(this.topModelId, 'modelId');
    this.db = new options.sql.Database();
    try {
      this.db.run(schema);
      this.db.run(
        'INSERT INTO col VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        collectionValues(
          createDeck(deckName, this.topDeckId),
          createModel(this.topDeckId, this.topModelId, definition),
        ),
      );
      this.decks.set('Default', createDeck('Default', 1));
      this.decks.set(deckName, createDeck(deckName, this.topDeckId));
      this.models.set(this.topModelId, createModel(this.topDeckId, this.topModelId, definition));
      this.addDeck(deckName);
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  addDeck(name: string, options: { deckId?: number } = {}): number {
    this.assertOpen();
    if (
      typeof name !== 'string' ||
      name.split('::').some((part) => !part.trim()) ||
      /[\u0000\u001f]/u.test(name)
    ) {
      throw new TypeError('Deck name must not be empty or contain empty hierarchy segments');
    }
    const existing = this.decks.get(name);
    const parent = name.split('::').slice(0, -1).join('::');
    if (parent) this.addDeck(parent);
    if (existing) {
      if (options.deckId !== undefined && existing.id !== options.deckId)
        throw new Error('Deck already has a different ID');
      return existing.id;
    }
    const id = options.deckId ?? stableId('deck', name);
    assertId(id, 'deckId');
    if ([...this.decks.values()].some((deck) => deck.id === id))
      throw new Error('Deck ID is already used');
    this.decks.set(name, createDeck(name, id));
    return id;
  }

  addModel(definition: ModelDefinition): number {
    this.assertOpen();
    const id = definition.id ?? stableId('model', [this.topDeckId, definition.name]);
    assertId(id, 'modelId');
    if (this.models.has(id)) throw new Error('Model ID is already used');
    const model = createModel(this.topDeckId, id, definition);
    this.models.set(id, model);
    return id;
  }

  addCard(front: string, back: string, options: CardOptions = {}): void {
    this.assertOpen();
    const model = this.models.get(options.modelId ?? this.topModelId);
    if (
      !model ||
      model.type !== 0 ||
      model.flds.length !== 2 ||
      model.flds[0]?.name !== 'Front' ||
      model.flds[1]?.name !== 'Back'
    ) {
      throw new Error('addCard requires a Front/Back model; use addNote for custom models');
    }
    if (typeof front === 'string' && !front.trim()) throw new TypeError('Front must not be empty');
    this.addNote([front, back], options);
  }

  addCloze(text: string, extra: string = '', options: CardOptions = {}): void {
    this.assertOpen();
    let modelId = options.modelId ?? this.topModelId;
    if (options.modelId === undefined && this.models.get(modelId)?.type !== 1) {
      const definition = defaultModel(this.deckName, { kind: 'cloze' });
      modelId = stableId('model', [this.topDeckId, definition.name]);
      if (!this.models.has(modelId)) this.addModel({ ...definition, id: modelId });
    }
    const model = this.models.get(modelId);
    if (
      !model ||
      model.type !== 1 ||
      model.flds.length !== 2 ||
      model.flds[0]?.name !== 'Text' ||
      model.flds[1]?.name !== 'Extra'
    ) {
      throw new Error('addCloze requires a Text/Extra cloze model; use addNote for custom models');
    }
    this.addNote([text, extra], { ...options, modelId });
  }

  addNote(input: NoteFields, options: CardOptions = {}): void {
    this.assertOpen();
    const modelId = options.modelId ?? this.topModelId;
    const model = this.models.get(modelId);
    if (!model) throw new Error('Unknown modelId');
    const fields: string[] = Array.isArray(input)
      ? [...input]
      : model.flds.map((field) => (input as Record<string, string>)[field.name]!);
    if (
      fields.length !== model.flds.length ||
      (!Array.isArray(input) && Object.keys(input).length !== fields.length)
    ) {
      throw new TypeError('Fields must match the model exactly');
    }
    fields.forEach(assertField);
    if (
      options.noteId !== undefined &&
      !(
        (typeof options.noteId === 'string' && options.noteId.length > 0) ||
        (typeof options.noteId === 'number' && Number.isSafeInteger(options.noteId))
      )
    ) {
      throw new TypeError('noteId must be a nonempty string or a safe integer');
    }
    const tags = this.formatTags(options.tags);
    const ords = this.cardOrdinals(model, fields);
    if (!ords.length)
      throw new TypeError(
        'Note does not generate any cards; check required fields or cloze deletions',
      );
    const deckId = options.deck === undefined ? this.topDeckId : this.addDeck(options.deck);
    const guid = sha1(
      JSON.stringify([
        this.topDeckId,
        modelId,
        options.noteId === undefined ? ['fields', fields] : ['id', options.noteId],
      ]),
    );
    const existing = this.query('SELECT id FROM notes WHERE guid = ?', [guid]);
    const noteId = typeof existing.id === 'number' ? existing.id : this.nextId++;
    const mod = Math.floor(Date.now() / 1000);
    this.db.run('INSERT OR REPLACE INTO notes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      noteId,
      guid,
      modelId,
      mod,
      -1,
      tags,
      fields.join('\u001f'),
      stripHtml(fields[model.sortf]!),
      parseInt(sha1(stripHtml(fields[0]!)).slice(0, 8), 16),
      0,
      '',
    ]);
    for (const ord of ords) {
      const card = this.query('SELECT id, due FROM cards WHERE nid = ? AND ord = ?', [noteId, ord]);
      this.db.run(
        'INSERT OR REPLACE INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          typeof card.id === 'number' ? card.id : this.nextId++,
          noteId,
          deckId,
          ord,
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
    this.db.run(
      `DELETE FROM cards WHERE nid = ? AND ord NOT IN (${ords.map(() => '?').join(',')})`,
      [noteId, ...ords],
    );
  }

  addCards(cards: Iterable<CardInput>): void {
    this.transaction(() => {
      for (const { front, back, ...options } of cards) this.addCard(front, back, options);
    });
  }

  addNotes(notes: Iterable<NoteInput>): void {
    this.transaction(() => {
      for (const { fields, ...options } of notes) this.addNote(fields, options);
    });
  }

  private transaction(run: () => void): void {
    this.assertOpen();
    const nextId = this.nextId;
    const nextDue = this.nextDue;
    const decks = new Map(this.decks);
    const models = new Map(this.models);
    this.db.run('BEGIN');
    try {
      run();
      this.db.run('COMMIT');
    } catch (error) {
      this.db.run('ROLLBACK');
      this.nextId = nextId;
      this.nextDue = nextDue;
      this.decks = decks;
      this.models = models;
      throw error;
    }
  }

  private cardOrdinals(model: AnkiModel, fields: string[]): number[] {
    if (model.type === 0)
      return model.req
        .filter(([, , required]) => required.every((ord) => fields[ord]!.trim()))
        .map(([ord]) => ord);
    const ords = new Set<number>();
    const question = model.tmpls[0]!.qfmt;
    for (const token of question.matchAll(/{{([^{}]+)}}/g)) {
      const parts = token[1]!.split(':');
      if (!parts.includes('cloze')) continue;
      const fieldIndex = model.flds.findIndex((field) => field.name === parts.at(-1));
      if (fieldIndex < 0) throw new TypeError('Cloze template refers to an unknown field');
      const text = fields[fieldIndex]!;
      for (const match of text.matchAll(/{{c([1-9]\d*)::/g)) {
        const start = match.index + match[0].length;
        let depth = 1;
        let cursor = start;
        for (; cursor < text.length && depth; cursor++) {
          const pair = text.slice(cursor, cursor + 2);
          if (pair === '{{') {
            depth++;
            cursor++;
          } else if (pair === '}}') {
            depth--;
            cursor++;
          }
        }
        if (
          depth ||
          !text
            .slice(start, cursor - 2)
            .split('::')[0]
            ?.trim()
        )
          continue;
        const number = Number(match[1]);
        if (number > 500) throw new TypeError('Cloze numbers must be between 1 and 500');
        ords.add(number - 1);
      }
    }
    return [...ords].sort((a, b) => a - b);
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

  save(options?: JSZip.JSZipGeneratorOptions<'uint8array'>): Promise<Uint8Array>;
  save<T extends JSZip.OutputType>(
    options: JSZip.JSZipGeneratorOptions<T> & { type: T },
  ): Promise<SaveOutput[T]>;
  save(
    options: JSZip.JSZipGeneratorOptions<JSZip.OutputType> = {},
  ): Promise<SaveOutput[JSZip.OutputType]> {
    this.assertOpen();
    this.db.run('UPDATE col SET decks = ?, models = ?, conf = ?, mod = ? WHERE id = 1', [
      JSON.stringify(Object.fromEntries([...this.decks.values()].map((deck) => [deck.id, deck]))),
      JSON.stringify(Object.fromEntries(this.models)),
      JSON.stringify({
        ...JSON.parse(String(this.query('SELECT conf FROM col', []).conf)),
        nextPos: this.nextDue,
      }),
      Date.now(),
    ]);
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
    return zip.generateAsync({
      ...options,
      type: options.type ?? 'uint8array',
      compression: options.compression ?? 'DEFLATE',
    });
  }

  close(): void {
    if (this.closed) return;
    this.db.close();
    this.media.clear();
    this.decks.clear();
    this.models.clear();
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
