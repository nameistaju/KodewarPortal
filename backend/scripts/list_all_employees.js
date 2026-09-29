import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Employee from '../src/models/Employee.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const employees = await Employee.find({});
  console.log('All employees in DB:', employees.map(e => ({ name: e.name, email: e.email, role: e.role })));

  await mongoose.disconnect();
}

run();
