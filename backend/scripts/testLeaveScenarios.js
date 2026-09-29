import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db.js';
import Employee from '../src/models/Employee.js';
import Leave from '../src/models/Leave.js';
import * as leaveService from '../src/services/leaveService.js';

const runTest = async () => {
  await connectDB();
  console.log('\n==================================================');
  console.log('STARTING LEAVE VALIDATION SCENARIO TESTS');
  console.log('==================================================\n');

  try {
    const testEmployee = await Employee.findOne({ role: 'EMPLOYEE' });
    if (!testEmployee) {
      console.error('Test employee not found. Please seed users first.');
      return;
    }
    console.log(`Using Test Employee: ${testEmployee.email} (${testEmployee._id})`);

    // Clean up any existing leaves for this employee to start fresh
    await Leave.deleteMany({ employee: testEmployee._id });
    console.log('Cleaned up existing leaves for test employee.\n');

    // SCENARIO 1: Create a leave successfully
    console.log('--- Scenario 1: Create a leave successfully ---');
    const s1Payload = {
      leaveType: 'SICK',
      startDate: new Date('2026-07-10'),
      endDate: new Date('2026-07-11'), // 2 days
      reason: 'Fever and cold recovery'
    };
    try {
      const leave = await leaveService.apply(testEmployee._id, s1Payload);
      console.log('✓ Success: Leave request created successfully.');
      console.log('Result:', {
        _id: leave._id,
        leaveType: leave.leaveType,
        totalDays: leave.totalDays,
        status: leave.status
      });
    } catch (err) {
      console.error('✕ Failed Scenario 1:', err.message);
    }
    console.log('');

    // SCENARIO 2: Create a leave with invalid dates (end date before start date)
    console.log('--- Scenario 2: Create a leave with invalid dates ---');
    const s2Payload = {
      leaveType: 'SICK',
      startDate: new Date('2026-07-15'),
      endDate: new Date('2026-07-14'), // End date is before start date
      reason: 'Should fail validation'
    };
    try {
      await leaveService.apply(testEmployee._id, s2Payload);
      console.error('✕ Failed: Expected validation error but request succeeded.');
    } catch (err) {
      console.log(`✓ Success: Correctly threw error. Status: ${err.statusCode || 400}. Message: "${err.message}"`);
    }
    console.log('');

    // SCENARIO 3: Create a leave with invalid leave type
    console.log('--- Scenario 3: Create a leave with invalid leave type ---');
    const s3Payload = {
      leaveType: 'MATERNITY', // Invalid enum value
      startDate: new Date('2026-07-20'),
      endDate: new Date('2026-07-21'),
      reason: 'Should fail validation'
    };
    try {
      await leaveService.apply(testEmployee._id, s3Payload);
      console.error('✕ Failed: Expected validation error but request succeeded.');
    } catch (err) {
      console.log(`✓ Success: Correctly threw error. Status: ${err.statusCode || 400}. Message: "${err.message}"`);
    }
    console.log('');

    // SCENARIO 4: Create a leave exceeding balance
    console.log('--- Scenario 4: Create a leave exceeding balance ---');
    const s4Payload = {
      leaveType: 'SICK',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-15'), // 15 days (allocated Sick Leave is 6, used is 0)
      reason: 'Exceeding remaining balance'
    };
    try {
      await leaveService.apply(testEmployee._id, s4Payload);
      console.error('✕ Failed: Expected validation error but request succeeded.');
    } catch (err) {
      console.log(`✓ Success: Correctly threw error. Status: ${err.statusCode || 400}. Message: "${err.message}"`);
    }
    console.log('');

    // SCENARIO 5: Create overlapping leave requests
    console.log('--- Scenario 5: Create overlapping leave requests ---');
    const s5Payload = {
      leaveType: 'CASUAL',
      startDate: new Date('2026-07-09'), // Overlaps with 2026-07-10 to 2026-07-11
      endDate: new Date('2026-07-10'),
      reason: 'Should fail overlap validation'
    };
    try {
      await leaveService.apply(testEmployee._id, s5Payload);
      console.error('✕ Failed: Expected validation error but request succeeded.');
    } catch (err) {
      console.log(`✓ Success: Correctly threw error. Status: ${err.statusCode || 400}. Message: "${err.message}"`);
    }
    console.log('');

    // SCENARIO 6: Create leave with missing employee
    console.log('--- Scenario 6: Create leave with missing employee ---');
    const missingEmployeeId = new mongoose.Types.ObjectId('6a389b9c626c94dd22766999');
    const s6Payload = {
      leaveType: 'SICK',
      startDate: new Date('2026-07-25'),
      endDate: new Date('2026-07-26'),
      reason: 'Should fail due to missing employee'
    };
    try {
      await leaveService.apply(missingEmployeeId, s6Payload);
      console.error('✕ Failed: Expected validation error but request succeeded.');
    } catch (err) {
      console.log(`✓ Success: Correctly threw error. Status: ${err.statusCode || 404}. Message: "${err.message}"`);
    }
    console.log('');

    console.log('==================================================');
    console.log('ALL TESTS COMPLETED');
    console.log('==================================================\n');

  } catch (error) {
    console.error('Test execution failed:', error);
  } finally {
    await disconnectDB();
  }
};

runTest().catch(console.error);
