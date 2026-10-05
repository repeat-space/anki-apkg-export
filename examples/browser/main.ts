import AnkiExport from 'anki-apkg-export';
import wasmUrl from 'anki-apkg-export/sql-wasm.wasm?url';
import './style.css';

const form = document.querySelector<HTMLFormElement>('#deck-form')!;
const cards = document.querySelector<HTMLDivElement>('#cards')!;
const kind = document.querySelector<HTMLSelectElement>('#kind')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const download = document.querySelector<HTMLButtonElement>('#download')!;
const files = new Map<string, File>();
let activeField: HTMLTextAreaElement | undefined;
let sequence = 0;

function updateRows() {
  const rows = cards.querySelectorAll<HTMLElement>('.card-row');
  rows.forEach((row, index) => {
    row.querySelector('.card-number')!.textContent = String(index + 1).padStart(2, '0');
    row.querySelector('.front-label')!.textContent = kind.value === 'cloze' ? 'Text' : 'Front';
    row.querySelector('.back-label')!.textContent = kind.value === 'cloze' ? 'Extra' : 'Back';
    row.querySelector<HTMLButtonElement>('.remove')!.disabled = rows.length === 1;
  });
  document.querySelector('#count')!.textContent = String(rows.length);
  document.querySelector<HTMLElement>('#cloze-help')!.hidden = kind.value !== 'cloze';
}

function addCard(front = '', back = '') {
  const template = document.querySelector<HTMLTemplateElement>('#card-template')!;
  const row = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
  row.dataset.noteId = String(++sequence);
  const frontField = row.querySelector<HTMLTextAreaElement>('.front')!;
  const backField = row.querySelector<HTMLTextAreaElement>('.back')!;
  frontField.value = front;
  backField.value = back;
  for (const field of [frontField, backField])
    field.addEventListener('focus', () => {
      activeField = field;
    });
  row.querySelector('.remove')!.addEventListener('click', () => {
    if (row.contains(activeField ?? null)) activeField = undefined;
    row.remove();
    updateRows();
  });
  cards.append(row);
  updateRows();
  return frontField;
}

document.querySelector('#add-card')!.addEventListener('click', () => addCard().focus());
kind.addEventListener('change', updateRows);
document.querySelector<HTMLInputElement>('#media-files')!.addEventListener('change', (event) => {
  const input = event.currentTarget as HTMLInputElement;
  for (const file of input.files ?? []) {
    if (files.has(file.name)) {
      status.textContent = `Already attached: ${file.name}`;
      continue;
    }
    if (!file.type.startsWith('image/') && !file.type.startsWith('audio/')) {
      status.textContent = 'Choose an image or audio file.';
      continue;
    }
    if (/[/\\:*?"<>|\u0000-\u001f]/u.test(file.name) || file.name.startsWith('.')) {
      status.textContent = `Unsupported filename: ${file.name}`;
      continue;
    }
    files.set(file.name, file);
    const filename = file.name.replace(/&/g, '&amp;').replace(/'/g, '&#39;');
    const field = activeField ?? cards.querySelector<HTMLTextAreaElement>('.front')!;
    field.value += file.type.startsWith('image/')
      ? `\n<img src="${filename}">`
      : `\n[sound:${file.name}]`;
    const item = document.createElement('li');
    item.textContent = file.name;
    document.querySelector('#media-list')!.append(item);
  }
  input.value = '';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  download.disabled = true;
  status.textContent = 'Preparing your deck…';
  let exporter: AnkiExport | undefined;
  try {
    const name = document.querySelector<HTMLInputElement>('#deck-name')!.value.trim();
    exporter = await AnkiExport.create(name, {
      kind: kind.value as 'basic' | 'reversed' | 'cloze',
      locateFile: () => wasmUrl,
    });
    for (const row of cards.querySelectorAll<HTMLElement>('.card-row')) {
      const front = row.querySelector<HTMLTextAreaElement>('.front')!.value;
      const back = row.querySelector<HTMLTextAreaElement>('.back')!.value;
      const options = {
        noteId: row.dataset.noteId!,
        tags: row.querySelector<HTMLInputElement>('.tags')!.value,
      };
      if (kind.value === 'cloze') exporter.addCloze(front, back, options);
      else exporter.addCard(front, back, options);
    }
    for (const [filename, file] of files) exporter.addMedia(filename, file);
    const blob = await exporter.save({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name.replace(/[/\\:*?"<>|]/g, '_')}.apkg`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'Downloaded. Open the file in Anki.';
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Could not create the deck.';
  } finally {
    exporter?.close();
    download.disabled = false;
  }
});

addCard('東京', 'Tokyo — the capital of Japan.');
