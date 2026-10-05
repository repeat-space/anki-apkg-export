import type { TemplateOptions } from './types.js';

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

export function createModel(
  deckName: string,
  deckId: number,
  modelId: number,
  options: TemplateOptions,
): AnkiModel {
  return {
    id: modelId,
    name: `${deckName} — Basic`,
    type: 0,
    mod: Math.floor(Date.now() / 1000),
    usn: -1,
    did: deckId,
    sortf: 0,
    tags: [],
    vers: [],
    flds: ['Front', 'Back'].map((name, ord) => ({
      name,
      ord,
      sticky: false,
      rtl: false,
      font: 'Arial',
      size: 20,
      media: [],
    })),
    tmpls: [
      {
        name: 'Card 1',
        ord: 0,
        qfmt: options.questionFormat ?? '{{Front}}',
        afmt: options.answerFormat ?? '{{FrontSide}}\n\n<hr id="answer">\n\n{{Back}}',
        bqfmt: '',
        bafmt: '',
        did: null,
      },
    ],
    req: [[0, 'all', [0]]],
    css: options.css ?? defaultCss,
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
