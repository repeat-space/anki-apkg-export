'use strict';

const {
  getAddCard,
  getDb,
  getCssTemplate,
  getLastItem,
  getMedia,
  getSave,
  getTemplate,
  getZip,
  rand
} = require('./helpers');

export const SEPARATOR = '\u001F';

export default function(deckName) {
  const db = getDb();
  const media = getMedia();
  const top_deck_id = rand();
  const top_model_id = rand();

  const update = (query, obj) => db.prepare(query).getAsObject(obj);
  const getFirstVal = query => JSON.parse(db.exec(query)[0].values[0]);
  /**
   * @param front
   * @param back
   */
  const addCard = getAddCard(
    update,
    top_deck_id,
    top_model_id,
    SEPARATOR
  );
  /**
   * Save db into file
   * @param options
   * @returns {*}
   */
  const save = getSave(
    getZip(),
    db,
    media.getContent()
  );

  db.run(getTemplate());

  const decks = getFirstVal('select decks from col');

  const deck = getLastItem(decks);
  deck.name = deckName;
  deck.id = top_deck_id;
  decks[top_deck_id + ''] = deck;

  update('update col set decks=:decks where id=1', { ':decks': JSON.stringify(decks) });

  const models = getFirstVal('select models from col');

  const model = getLastItem(models);
  model.name = deckName;
  model.css = getCssTemplate();
  model.did = top_deck_id;
  model.id = top_model_id;

  models[top_model_id + ''] = model;

  update('update col set models=:models where id=1', { ':models': JSON.stringify(models) });

  return {
    addMedia: media.addMedia,
    addCard,
    save
  };
}
