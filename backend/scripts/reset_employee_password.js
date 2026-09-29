import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Employee from '../src/models/Employee.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const employee = await Employee.findOne({ email: 'employee@sharpkode.com' }).select('+password +loginAttempts +lockUntil');
  if (!employee) {
    console.log('Employee not found');
    process.exit(1);
  }

  console.log('Current lockUntil:', employee.lockUntil);
  console.log('Current loginAttempts:', employee.loginAttempts);

  // Set plain text - pre-save hook will hash it
  employee.password = 'Taju@2003';
  employee.loginAttempts = 0;
  employee.lockUntil = undefined;
  employee.mustChangePassword = false;
  employee.forcePasswordChange = false;
  await employee.save();
  
  console.log('Account unlocked and password updated for employee@sharpkode.com');
  console.log('Password set to: Taju@2003');

  await mongoose.disconnect();
}

run();
