import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Employee from '../src/models/Employee.js';

dotenv.config();

export async function runTracksAttendanceMigration() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Migration skipped: MONGODB_URI is not set');
    return;
  }

  // Ensure connected
  let shouldClose = false;
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(uri);
    shouldClose = true;
  }

  console.log('Running tracksAttendance backfill migration...');
  
  // Find all employees without tracksAttendance
  const employees = await Employee.find({
    $or: [
      { tracksAttendance: { $exists: false } },
      { tracksAttendance: null }
    ]
  });

  console.log(`Found ${employees.length} employee records to backfill.`);

  let updatedCount = 0;
  for (const emp of employees) {
    emp.tracksAttendance = (emp.role === 'EMPLOYEE');
    await emp.save();
    updatedCount += 1;
  }

  console.log(`Backfilled tracksAttendance for ${updatedCount} employees.`);

  if (shouldClose) {
    await mongoose.disconnect();
  }
}

// Run immediately if executed directly
if (process.argv[1] && process.argv[1].endsWith('migrateTracksAttendance.js')) {
  runTracksAttendanceMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
