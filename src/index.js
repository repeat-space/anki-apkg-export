'use strict';

const {
  getAddCard,
  getDb,
  getLastItem,
  getMedia,
  getSave,
  getTemplate,
  getZip,
  rand
} = require('./helpers');

export const SEPARATOR = '\u001F';

export default function(deckName) {
  const options = {
    name: deckName,
    model_name: deckName,
    css: ` .card {
      font-family: arial;
      font-size: 20px;
      text-align: center;
      color: black;
    }`
  };

  const db = getDb();
  db.run(getTemplate());

  const top_deck_id = rand();

  const getFirstVal = query => JSON.parse(db.exec(query)[0].values[0]);
  const decks = getFirstVal('select decks from col');

  const deck = getLastItem(decks);

  deck.name = options.name;
  deck.id = top_deck_id;

  decks[top_deck_id + ''] = deck;

  const update = (query, obj) => db.prepare(query).getAsObject(obj);

  update('update col set decks=:decks where id=1', { ':decks': JSON.stringify(decks) });
  // console.log(getFirstVal('select decks from col'));

  const top_model_id = rand();
  const models = getFirstVal('select models from col');
  const model = getLastItem(models);

  model.name = options.name;
  model.css = options.css;
  model.did = top_deck_id;
  model.id = top_model_id;

  models[top_model_id + ''] = model;

  update('update col set models=:models where id=1', { ':models': JSON.stringify(models) });
  // console.log(getFirstVal('select models from col'));

  const media = getMedia();

  /**
   *
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

  return {
    addMedia: media.addMedia,
    addCard,
    save
  };
}
