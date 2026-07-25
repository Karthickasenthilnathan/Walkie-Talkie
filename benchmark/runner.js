import 'dotenv/config';
import { runScenario } from './scenarios.js';
import printReport from './report.js';
import { closeSeedDatabase } from './seed.js';

const modes = ['postgresql', 'redis'];
const missedCounts = [50, 200, 1000];
const parsedClients = Number(process.env.BENCHMARK_CLIENTS || 0);
const clientCounts = parsedClients > 0 ? [parsedClients] : [500, 1000];
const args = new Set(process.argv.slice(2));

if (args.has('--dry-run')) {
  for (const mode of modes) {
    for (const clientCount of clientCounts) {
      for (const missedCount of missedCounts) {
        console.log(`${mode}: ${clientCount} clients, ${missedCount} missed messages`);
      }
    }
  }
} else {
  const results = [];
  try {
    for (const mode of modes) {
      for (const clientCount of clientCounts) {
        for (const missedCount of missedCounts) {
          console.log(`Running ${mode}, ${clientCount} clients, ${missedCount} missed messages...`);
          results.push(await runScenario(mode, clientCount, missedCount));
        }
      }
    }
    printReport(results);
  } finally {
    await closeSeedDatabase();
  }
}

