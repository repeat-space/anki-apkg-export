/** Cards are what you review.
 *
 * There can be multiple cards for each note, as determined by the Template.
 */
export interface Card {
  /** the epoch milliseconds of when the card was created */
  id: number;

  /** notes.id */
  nid: number;

  /** deck id (available in col table) */
  did: number;

  /** ordinal : identifies which of the card templates or cloze deletions it corresponds to for card templates, valid values are from 0 to num templates - 1
   *
   *   for cloze deletions, valid values are from 0 to max cloze index - 1 (they're 0 indexed despite the first being called `c1`)
   */
  ord: number;

  /** modificaton time as epoch seconds */
  mod: number;

  /** update sequence number : used to figure out diffs when syncing.
   *   value of -1 indicates changes that need to be pushed to server.
   *   usn < server usn indicates changes that need to be pulled from server.
   */
  usn: number;

  /** 0=new, 1=learning, 2=review, 3=relearning */
  type: 0 | 1 | 2 | 3;

  /** -3=user buried(In scheduler 2),
   * -2=sched buried (In scheduler 2),
   * -2=buried(In scheduler 1),
   * -1=suspended,
   * 0=new,
   * 1=learning,
   * 2=review (as for type)
   * 3=in learning, next rev in at least a day after the previous review
   * 4=preview
   */
  queue: -3 | -1 | -2 | -1 | 0 | 1 | 2 | 3 | 4;

  /** Due is used differently for different card types:
   *   new: note id or random int
   *   due: integer day, relative to the collection's creation time
   *   learning: integer timestamp in second
   */
  due: number;

  /** interval (used in SRS algorithm). Negative = seconds, positive = days */
  ivl: number;

  /** The ease factor of the card in permille (parts per thousand). If the ease factor is 2500, the card’s interval will be multiplied by 2.5 the next time you press Good. */
  factor: number;

  /** number of reviews */
  reps: number;

  /** the number of times the card went from a "was answered correctly" to "was answered incorrectly" state */
  lapses: number;

  /** of the form a*1000+b, with:
   *
   * a the number of reps left today
   * b the number of reps left till graduation
   *
   * for example: '2004' means 2 reps left today and 4 reps till graduation
   */
  left: number;

  /** original due:
   * In filtered decks, it's the original due date that the card had before moving to filtered.
   *
   * If the card lapsed in scheduler1, then it's the value before the lapse.
   * (This is used when switching to scheduler 2. At this time, cards in learning becomes due again, with their previous due date)
   *
   * In any other case it's 0. */
  odue: number;

  /** original did: only used when the card is currently in filtered deck */
  odid: number;

  /** This integer mod 8 represents a "flag", which can be see in browser and while reviewing a note. Red 1, Orange 2, Green 3, Blue 4, no flag: 0. This integer divided by 8 represents currently nothing */
  flags: number;

  /** currently unused */
  data: string;
}

/** Notes contain the raw information that is formatted into a number of cards according to the models */
export interface Note {
  /** epoch milliseconds of when the note was created */
  id: number;

  /** globally unique id, almost certainly used for syncing */
  guid: number;

  /** model id */
  mid: number;

  /** modification timestamp, epoch seconds */
  mod: number;

  /** update sequence number: for finding diffs when syncing.
   *
   * See the description in the cards table for more info
   */
  usn: number;

  /** space-separated string of tags.
   *
   * includes space at the beginning and end, for LIKE "% tag %" queries
   */
  tags: string;

  /** the values of the fields in this note. separated by 0x1f (31) character. */
  flds: string;

  /** sort field: used for quick sorting and duplicate check.
   *
   * The sort field is an integer so that when users are sorting on a field that contains only numbers, they are sorted in numeric instead of lexical order.
   *
   * Text is stored in this integer field.
   */
  sfld: number;

  /** field checksum used for duplicate check.
   *
   *   integer representation of first 8 digits of sha1 hash of the first field
   */
  csum: number;

  /** unused */
  flags: number;

  /** unused */
  data: number;
}

export interface Deck {
  /** name of deck */
  name: string;

  /** extended review card limit (for custom study)
   *
   * Potentially absent, in this case it's considered to be 10 by aqt.customstudy
   */
  extendRev: number;

  /** Update sequence number: used in same way as other usn vales in db */
  usn: number;

  /** true when deck is collapsed */
  collapsed: boolean;

  /** two number array.
   *
   * - First one is the number of days that have passed between the collection was created and the deck was last updated
   * - The second one is equal to the number of cards seen today in this deck minus the number of new cards in custom study today.
   * BEWARE, it's changed in anki.sched(v2).Scheduler._updateStats and anki.sched(v2).Scheduler._updateCutoff.update  but can't be found by grepping 'newToday', because it's instead written as type+"Today" with type which may be new/rev/lrnToday
   */
  newToday: [number, number];

  /** two number array.
   *
   * - First one is the number of days that have passed between the collection was created and the deck was last updated
   * - The second one is equal to the number of cards seen today in this deck minus the number of new cards in custom study today.
   * BEWARE, it's changed in anki.sched(v2).Scheduler._updateStats and anki.sched(v2).Scheduler._updateCutoff.update  but can't be found by grepping 'newToday', because it's instead written as type+"Today" with type which may be new/rev/lrnToday
   */
  revToday: [number, number];

  /** two number array.
   *
   * - First one is the number of days that have passed between the collection was created and the deck was last updated
   * - The second one is equal to the number of cards seen today in this deck minus the number of new cards in custom study today.
   * BEWARE, it's changed in anki.sched(v2).Scheduler._updateStats and anki.sched(v2).Scheduler._updateCutoff.update  but can't be found by grepping 'newToday', because it's instead written as type+"Today" with type which may be new/rev/lrnToday
   */
  lrnToday: [number, number];

  /** two number array used somehow for custom study. Currently unused in the code */
  timeToday: [number, number];

  /** 1 if dynamic (AKA filtered) deck */
  dyn: number;

  /** extended new card limit (for custom study).
   *
   * Potentially absent, in this case it's considered to be 10 by aqt.customstudy
   */
  extendNew: number;

  /** id of option group from dconf in `col` table. Or absent if the deck is dynamic.
   *
   * Its absent in filtered deck
   */
  conf: number;

  /** deck ID (automatically generated long) */
  id: number;

  /** last modification time */
  mod: number;

  /** deck description */
  desc: string;
}

export interface Conf {
  /** The id (as int) of the last deck selected (during review, adding card, changing the deck of a card) */
  curDeck: number;

  /** The list containing the current deck id and its descendent (as ints) */
  activeDecks: number[];

  /** In which order to view to review the cards.
   * This can be selected in Preferences>Basic.
   *
   * Possible values are:
   *
   * - 0 -- NEW_CARDS_DISTRIBUTE (Mix new cards and reviews)
   * - 1 -- NEW_CARDS_LAST (see new cards after review)
   * - 2 -- NEW_CARDS_FIRST (See new card before review)
   */
  newSpread: 0 | 1 | 2;

  /** 'Preferences>Basic>Learn ahead limit'*60.
   *
   * If there is no more card to review now but next card in learning is in less than collapseTime second, show it now.
   * If there are no other card to review, then we can review cards in learning in advance if they are due in less than this number of seconds.
   */
  collapseTime: number;

  /** 'Preferences>Basic>Timebox time limit'*60.
   *
   * Each time this number of second elapse, anki tell you how many card you reviewed.
   */
  timeLim: number;

  /** 'Preferences>Basic>Show next review time above answer buttons'. */
  estTimes: boolean;

  /** 'Preferences>Basic>Show remaining card count during review'. */
  dueCounts: boolean;

  /** Id (as string) of the last note type (a.k.a. model) used (i.e. either when creating a note, or changing the note type of a note). */
  curModel: string;

  /** This is the highest value of a due value of a new card.
   *
   * It allows to decide the due number to give to the next note created.
   * (This is useful to ensure that cards are seen in order in which they are added.
   */
  nextPos: number;

  /** A string representing how the browser must be sorted.
   *
   * Its value should be one of the possible value of 'aqt.browsers.DataModel.activeCols' (or equivalently of 'activeCols'  but not any of ('question', 'answer', 'template', 'deck', 'note', 'noteTags') */
  sortType:
    | "noteFld"
    | "noteCrt"
    | "noteMod"
    | "cardMod"
    | "cardDue"
    | "cardIvl"
    | "cardEase"
    | "cardReps"
    | "cardLapses";

  /** whether the browser sorting must be in increasing or decreasing order */
  sortBackwards: boolean;

  /** True for 'When adding, default to current deck' in Preferences>Basic. False for 'Change deck depending on note type'. */
  addToCur: boolean;

  /** Always set to true and not read anywhere in the code but at the place where it is set to True if it is not already true.
   *
   * Hence probably quite useful. */
  newBury: boolean;

  /** It corresponds to the option 'Show learning cards with larger steps before reviews'.
   *
   * But this option does not seems to appear in the preference box */
  dayLearnFirst?: boolean;

  /** The date of the last time the scheduler was initialized or reset.
   *
   * If it's not today, then buried notes must be unburied.
   *
   * This is not in the json until scheduler is used once. */
  lastUnburied?: number;

  /** the list of name of columns to show in the browser.
   *
   * Possible values are listed in aqt.browser.Browser.setupColumns. They are:
   *
   * 'question' -- the browser column'Question',
   * 'answer' -- the browser column'Answer',
   * 'template' -- the browser column'Card',
   * 'deck' -- the browser column'Deck',
   * 'noteFld' -- the browser column'Sort Field',
   * 'noteCrt' -- the browser column'Created',
   * 'noteMod' -- the browser column'Edited',
   * 'cardMod' -- the browser column'Changed',
   * 'cardDue' -- the browser column'Due',
   * 'cardIvl' -- the browser column'Interval',
   * 'cardEase' -- the browser column'Ease',
   * 'cardReps' -- the browser column'Reviews',
   * 'cardLapses' -- the browser column'Lapses',
   * 'noteTags' -- the browser column'Tags',
   * 'note' -- the browser column'Note',
   *
   * The default columns are: noteFld, template, cardDue and deck
   *
   * This is not in the json at creaton. It's added when the browser is open.
   */
  activeCols?: string[];
}

export interface Model {
  /** CSS, shared for all templates */
  css: string;

  /**  Long specifying the id of the deck that cards are added to by default */
  did: number;

  /** JSONArray containing object for each field in the model as follows: */
  flds: Field[];

  /**  model ID, matches notes.mid */
  id: number;

  /**  String added to end of LaTeX expressions (usually \\end{document}) */
  latexPost: string;

  /**  preamble for LaTeX expressions */
  latexPre: string;

  /**  modification time in seconds */
  mod: number;

  /**  model name */
  name: string;

  /** req is unused in modern clients. May exist for backwards compatibility.
   *
   * https://forums.ankiweb.net/t/is-req-still-used-or-present/9977
   *
   * AnkiDroid 2.14 uses it, AnkiDroid 2.15 does not use it but still generates it.
   * Array of arrays describing, for each template T, which fields are required to generate T.
   *
   * The array is of the form [T,string,list], where:
   *
   * - T is the ordinal of the template.
   * - The string is 'none', 'all' or 'any'.
   * - The list contains ordinal of fields, in increasing order.
   *    The meaning is as follows:
   *    - if the string is 'none', then no cards are generated for this template. The list should be empty.
   *    - if the string is 'all' then the card is generated only if each field of the list are filled
   *    - if the string is 'any', then the card is generated if any of the field of the list is filled.
   *
   * The algorithm to decide how to compute req from the template is explained on:
   *
   * https://github.com/Arthur-Milchior/anki/blob/commented/documentation//templates_generation_rules.md
   */
  req: [number, "none" | "all" | "any", number[]][];

  /**  Integer specifying which field is used for sorting in the browser */
  sortf: number;

  /**  Anki saves the tags of the last added note to the current model, use an empty array [] */
  tags: string[];

  /** JSONArray containing object of CardTemplate for each card in model */
  tmpls: Template[];

  /**  Integer specifying what type of model. 0 for standard, 1 for cloze */
  type: number;

  /**  usn: Update sequence number: used in same way as other usn vales in db */
  usn: number;

  /**  Legacy version number (unused), use an empty array [] */
  vers: [];
}

/** Fields in the Model */
export interface Field {
  /**  display font */
  font: string;
  /**  array of media. appears to be unused */
  media: unknown[];
  /**  field name */
  name: string;
  /**  ordinal of the field - goes from 0 to num fields -1 */
  ord: number;
  /**  boolean, right-to-left script */
  rtl: boolean;
  /**  font size */
  size: number;
  /**  sticky fields retain the value that was last added when adding new notes */
  sticky: boolean;
}

/** CardTemplate */
export interface Template {
  /**  answer template string */
  afmt: string;

  /**  browser answer format: used for displaying answer in browser */
  bafmt: string;

  /**  browser question format: used for displaying question in browser */
  bqfmt: string;

  /**  deck override (null by default) */
  did: null;

  /**  template name */
  name: string;

  /**  template number, see flds */
  ord: number;

  /**  question format string */
  qfmt: string;
}

/** The configuration for a deck */
export interface DConf {
  /** whether the audio associated to a question should be played when the question is shown */
  autoplay: boolean;

  /** Whether this deck is dynamic.
   *
   * Not present by default in decks.py
   */
  dyn?: boolean;

  /** deck ID (automatically generated long).
   *
   * Not present by default in decks.py
   */
  id?: number;

  /** The configuration for lapse cards. */
  lapse: Lapse;

  /** The number of seconds after which to stop the timer */
  maxTaken: number;

  /** Last modification time */
  mod: number;

  /** The name of the configuration */
  name: string;

  /** The configuration for new cards. */
  new: New;

  /** whether the audio associated to a question should be played when the answer is shown */
  replayq: boolean;

  /** The configuration for review cards. */
  rev: Rev;

  /** whether timer should be shown (1) or not (0) */
  timer: 0 | 1;

  /** See usn in cards table for details. */
  usn: number;
}

/** The configuration for lapse cards. */
export interface Lapse {
  /** The list of successive delay between the learning steps of the new cards, as explained in the manual. */
  delays: number[];

  /** What to do to leech cards. 0 for suspend, 1 for mark. Numbers according to the order in which the choices appear in aqt/dconf.ui */
  leechAction: 0 | 1;

  /** the number of lapses authorized before doing leechAction. */
  leechFails: number;

  /** a lower limit to the new interval after a leech */
  minInt: number;

  /** percent by which to multiply the current interval when a card goes has lapsed */
  mult: number;
}

/** The configuration for new cards. */
export interface New {
  /** Whether to bury cards related to new cards answered */
  bury: boolean;

  /** The list of successive delay between the learning steps of the new cards, as explained in the manual. */
  delays: number[];

  /** The initial ease factor */
  initialFactor: number;

  /** The list of delays according to the button pressed while leaving the learning mode.
   *
   * Good, easy and unused.
   *
   * In the GUI, the first two elements corresponds to Graduating Interval and Easy interval */
  ints: [number, number, number];

  /** In which order new cards must be shown. NEW_CARDS_RANDOM = 0 and NEW_CARDS_DUE = 1. */
  order: number;

  /**Maximal number of new cards shown per day. */
  perDay: number;

  /** Seems to be unused in the code." */
  separate: boolean;
}

/** The configuration for review cards. */
export interface Rev {
  /**  Whether to bury cards related to new cards answered */
  bury: boolean;

  /**  the number to add to the easyness when the easy button is pressed */
  ease4: number;

  /**  The new interval is multiplied by a random number between -fuzz and fuzz */
  fuzz: number;

  /**  multiplication factor applied to the intervals Anki generates */
  ivlFct: number;

  /**  the maximal interval for review */
  maxIvl: number;

  /**  not currently used according to decks.py code's comment */
  minSpace: number;

  /**  Numbers of cards to review per day */
  perDay: number;
}
