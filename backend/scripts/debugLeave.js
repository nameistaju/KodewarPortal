import 'dotenv/config';
import { connectDB, disconnectDB } from '../src/config/db.js';
import Employee from '../src/models/Employee.js';
import * as leaveService from '../src/services/leaveService.js';

const test = async () => {
  await connectDB();
  try {
    const employee = await Employee.findOne({ role: 'EMPLOYEE' });
    if (!employee) {
      console.log('No employee found, please seed users first.');
      return;
    }
    console.log('Testing leave for employee:', employee.email, employee._id);

    const payload = {
      leaveType: 'SICK',
      startDate: new Date('2026-06-25'),
      endDate: new Date('2026-06-26'),
      reason: 'Fever'
    };

    console.log('Applying leave...');
    const result = await leaveService.apply(employee._id, payload);
    console.log('Result:', result);
  } catch (error) {
    console.error('Error caught:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await disconnectDB();
  }
};

test().catch(console.error);
