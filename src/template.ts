import type { ExportOptions, ModelDefinition } from './types.js';

export const defaultCss: string =
  '.card { font-family: sans-serif; font-size: 20px; text-align: center; }\n';

export interface AnkiModel {
  id: number;
  name: string;
  type: number;
  mod: number;
  usn: number;
  did: number;
  sortf: number;
  tags: string[];
  vers: unknown[];
  flds: {
    name: string;
    ord: number;
    sticky: boolean;
    rtl: boolean;
    font: string;
    size: number;
    media: string[];
  }[];
  tmpls: {
    name: string;
    ord: number;
    qfmt: string;
    afmt: string;
    bqfmt: string;
    bafmt: string;
    did: null;
  }[];
  req: [number, string, number[]][];
  css: string;
  latexPre: string;
  latexPost: string;
}

export interface AnkiDeck {
  id: number;
  name: string;
  desc: string;
  mod: number;
  usn: number;
  conf: number;
  dyn: number;
  collapsed: boolean;
  extendNew: number;
  extendRev: number;
  newToday: number[];
  revToday: number[];
  lrnToday: number[];
  timeToday: number[];
}

export function createDeck(name: string, id: number): AnkiDeck {
  return {
    id,
    name,
    desc: '',
    mod: Math.floor(Date.now() / 1000),
    usn: -1,
    conf: 1,
    dyn: 0,
    collapsed: false,
    extendNew: 0,
    extendRev: 0,
    newToday: [0, 0],
    revToday: [0, 0],
    lrnToday: [0, 0],
    timeToday: [0, 0],
  };
}

export function defaultModel(deckName: string, options: ExportOptions): ModelDefinition {
  const kind = options.kind ?? 'basic';
  if (!['basic', 'reversed', 'cloze'].includes(kind)) throw new TypeError('Unknown model kind');
  if (options.model) return options.model;
  if (kind === 'cloze')
    return {
      name: `${deckName} — Cloze`,
      type: 'cloze',
      fields: ['Text', 'Extra'],
      css: options.css,
      templates: [
        {
          name: 'Cloze',
          questionFormat: options.questionFormat ?? '{{cloze:Text}}',
          answerFormat: options.answerFormat ?? '{{cloze:Text}}<br>{{Extra}}',
        },
      ],
    };
  const templates = [
    {
      name: 'Forward',
      questionFormat: options.questionFormat ?? '{{Front}}',
      answerFormat: options.answerFormat ?? '{{FrontSide}}\n\n<hr id="answer">\n\n{{Back}}',
      requiredFields: ['Front'],
    },
  ];
  if (kind === 'reversed')
    templates.push({
      name: 'Reverse',
      questionFormat: '{{Back}}',
      answerFormat: '{{FrontSide}}<hr id="answer">{{Front}}',
      requiredFields: ['Back'],
    });
  return {
    name: `${deckName} — ${kind === 'reversed' ? 'Reversed' : 'Basic'}`,
    fields: ['Front', 'Back'],
    templates,
    css: options.css,
  };
}

export function createModel(
  deckId: number,
  modelId: number,
  definition: ModelDefinition,
): AnkiModel {
  const { name, fields, templates } = definition;
  if (typeof name !== 'string' || !name.trim()) throw new TypeError('Model name must not be empty');
  if (
    !Array.isArray(fields) ||
    !fields.length ||
    new Set(fields).size !== fields.length ||
    fields.some(
      (field) => typeof field !== 'string' || !field.trim() || /[{}:\u0000\u001f]/u.test(field),
    )
  ) {
    throw new TypeError(
      'Model fields must have unique, nonempty names without template delimiters',
    );
  }
  if (definition.type !== undefined && !['basic', 'cloze'].includes(definition.type))
    throw new TypeError('Unknown model type');
  if (
    !Array.isArray(templates) ||
    !templates.length ||
    new Set(templates.map((template) => template.name)).size !== templates.length
  ) {
    throw new TypeError('A model needs templates with unique names');
  }
  if (definition.type === 'cloze' && templates.length !== 1)
    throw new TypeError('A cloze model needs exactly one template');
  for (const template of templates) {
    if (
      typeof template.name !== 'string' ||
      !template.name.trim() ||
      typeof template.questionFormat !== 'string' ||
      !template.questionFormat.trim() ||
      typeof template.answerFormat !== 'string'
    ) {
      throw new TypeError('Each template needs a name, questionFormat and answerFormat');
    }
  }
  const sortf = definition.sortField === undefined ? 0 : fields.indexOf(definition.sortField);
  if (sortf < 0) throw new TypeError('Unknown sortField');
  const req: AnkiModel['req'] = templates.map((template, ord) => {
    const required = template.requiredFields ?? [fields[0]!];
    if (
      !Array.isArray(required) ||
      !required.length ||
      required.some((field) => !fields.includes(field))
    ) {
      throw new TypeError('requiredFields must name existing model fields');
    }
    return [ord, 'all', required.map((field) => fields.indexOf(field))];
  });
  return {
    id: modelId,
    name,
    type: definition.type === 'cloze' ? 1 : 0,
    mod: Math.floor(Date.now() / 1000),
    usn: -1,
    did: deckId,
    sortf,
    tags: [],
    vers: [],
    flds: fields.map((name, ord) => ({
      name,
      ord,
      sticky: false,
      rtl: false,
      font: 'Arial',
      size: 20,
      media: [],
    })),
    tmpls: templates.map((template, ord) => ({
      name: template.name,
      ord,
      qfmt: template.questionFormat,
      afmt: template.answerFormat,
      bqfmt: '',
      bafmt: '',
      did: null,
    })),
    req,
    css: definition.css ?? defaultCss,
    latexPre:
      '\\documentclass[12pt]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\begin{document}',
    latexPost: '\\end{document}',
  };
}

export function collectionValues(deck: AnkiDeck, model: AnkiModel): (string | number)[] {
  const now = Date.now();
  const conf = {
    nextPos: 1,
    activeDecks: [deck.id],
    curDeck: deck.id,
    curModel: String(model.id),
    sortType: 'noteFld',
    sortBackwards: false,
    addToCur: true,
    newSpread: 0,
    dueCounts: true,
    timeLim: 0,
    estTimes: true,
    collapseTime: 1200,
  };
  const preset = {
    id: 1,
    name: 'Default',
    mod: 0,
    usn: 0,
    maxTaken: 60,
    autoplay: true,
    replayq: true,
    timer: 0,
    new: {
      perDay: 20,
      delays: [1, 10],
      ints: [1, 4, 7],
      initialFactor: 2500,
      bury: true,
      order: 1,
    },
    rev: { perDay: 200, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, ease4: 1.3, bury: true },
    lapse: { leechFails: 8, minInt: 1, delays: [10], leechAction: 0, mult: 0 },
  };
  return [
    1,
    Math.floor(now / 1000),
    now,
    now,
    11,
    0,
    -1,
    0,
    JSON.stringify(conf),
    JSON.stringify({ [model.id]: model }),
    JSON.stringify({ 1: createDeck('Default', 1), [deck.id]: deck }),
    JSON.stringify({ 1: preset }),
    '{}',
  ];
}
