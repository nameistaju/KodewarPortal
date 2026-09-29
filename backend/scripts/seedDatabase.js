import 'dotenv/config';
import { runDevelopmentBootstrap } from '../src/utils/devBootstrap.js';

const run = async () => {
  try {
    await runDevelopmentBootstrap();
    console.log('Database seed completed successfully');
  } catch (err) {
    console.error('Database seed failed:', err.message);
    process.exitCode = 1;
  }
};

run();
