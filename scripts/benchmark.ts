import { performance } from 'node:perf_hooks';
import AnkiExport from '../src/index.js';

const count = Number(process.argv[2] ?? 10_000);
if (!Number.isSafeInteger(count) || count < 1)
  throw new Error('Card count must be a positive integer');
const exporter = await AnkiExport.create('Benchmark');
const start = performance.now();
const rss = process.memoryUsage().rss;
try {
  exporter.addCards(
    (function* () {
      for (let i = 0; i < count; i++)
        yield { front: `Question ${i}`, back: `Answer ${i}`, noteId: i };
    })(),
  );
  const inserted = performance.now();
  const bytes = await exporter.save();
  console.log(
    JSON.stringify(
      {
        cards: count,
        insertMs: Math.round(inserted - start),
        exportMs: Math.round(performance.now() - inserted),
        bytes: bytes.length,
        rssDeltaMiB: Math.round((process.memoryUsage().rss - rss) / 1024 / 1024),
      },
      null,
      2,
    ),
  );
} finally {
  exporter.close();
}
