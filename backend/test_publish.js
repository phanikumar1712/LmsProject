const { query } = require('./src/db/pool');
require('dotenv').config();

async function run() {
  try {
     console.log('Publishing all courses...');
     await query("UPDATE courses SET status = 'PUBLISHED'");
     console.log('Done!');
  } catch(err) {
     console.error(err);
  } finally {
     process.exit();
  }
}
run();
