import Exporter from './exporter';
import createTemplate from './template';

export { Exporter };

export default function(deckName, template, sql) {
  return new Exporter(deckName, {
    template: createTemplate(template),
    sql
  });
}
