import 'dotenv/config';
import { runDevelopmentBootstrap } from '../src/utils/devBootstrap.js';

const run = async () => {
  try {
    await runDevelopmentBootstrap();
    console.log('Seeding completed');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
};

run();

