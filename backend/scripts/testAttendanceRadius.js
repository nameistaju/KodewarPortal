import 'dotenv/config';
import { connectDB, disconnectDB } from '../src/config/db.js';
import Employee from '../src/models/Employee.js';
import Attendance from '../src/models/Attendance.js';
import { startOfDay } from '../src/utils/date.js';

const baseUrl = 'http://localhost:5000/api';

const runTests = async () => {
  // Connect to DB to perform clean up
  console.log('Connecting to database for test setup...');
  await connectDB();

  const employee = await Employee.findOne({ email: 'rahulmarketing@sharpkode.com' });
  if (!employee) {
    console.error('Test employee not found. Seed first.');
    await disconnectDB();
    process.exit(1);
  }

  const today = startOfDay();
  console.log(`Cleaning up attendance records for ${employee.email} on date ${today.toISOString()}...`);
  await Attendance.deleteMany({ employee: employee._id, date: today });
  console.log('Cleaned up. Disconnecting from database...');
  await disconnectDB();

  console.log('\n==================================================');
  console.log('STARTING ATTENDANCE RADIUS & PHONE DUPLICATE TESTS');
  console.log('==================================================\n');

  // 1. Log in as employee
  console.log('Logging in as employee (rahulmarketing@sharpkode.com)...');
  const empLoginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'rahulmarketing@sharpkode.com',
      password: 'NkwZhNXefYuKAa1!',
      role_type: 'employee'
    })
  });

  const empLoginData = await empLoginRes.json();
  if (!empLoginRes.ok) {
    console.error('Failed to log in as employee:', empLoginData);
    process.exit(1);
  }
  const empToken = empLoginData.data.accessToken;
  console.log('Employee logged in successfully.\n');

  // Helper to punch
  const punch = async (action, lat, lng) => {
    const res = await fetch(`${baseUrl}/attendance/punch-${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${empToken}`
      },
      body: JSON.stringify({
        latitude: lat,
        longitude: lng,
        notes: `Test ${action} from ${lat}, ${lng}`
      })
    });
    return {
      status: res.status,
      data: await res.json()
    };
  };

  // Test Punch In Outside Radius (should return 400 "User is outside office radius")
  console.log('Testing Punch In OUTSIDE radius (12.0, 80.0)...');
  const pinOutside = await punch('in', 12.0, 80.0);
  console.log(`Status: ${pinOutside.status}`);
  console.log('Response:', pinOutside.data);
  if (pinOutside.status === 400 && pinOutside.data.message.includes('outside office radius')) {
    console.log('✅ PASS: Punch In outside radius successfully blocked.');
  } else {
    console.error('❌ FAIL: Punch In outside radius did not return 400 with expected message.');
    process.exitCode = 1;
  }
  console.log('');

  // Test Punch In Inside Radius (should succeed with 201)
  console.log('Testing Punch In INSIDE office radius (17.7283443, 83.3144685)...');
  const pinInside = await punch('in', 17.7283443, 83.3144685);
  console.log(`Status: ${pinInside.status}`);
  console.log('Response:', pinInside.data);
  if (pinInside.status === 200 || pinInside.status === 201) {
    console.log('✅ PASS: Punch In inside radius succeeded.');
  } else {
    console.error('❌ FAIL: Punch In inside radius failed.');
    process.exitCode = 1;
  }
  console.log('');

  // Test Punch Out Outside Radius (should succeed with 200/201 because radius is bypassed for Punch Out)
  console.log('Testing Punch Out OUTSIDE radius (12.0, 80.0)...');
  const poutOutside = await punch('out', 12.0, 80.0);
  console.log(`Status: ${poutOutside.status}`);
  console.log('Response:', poutOutside.data);
  if (poutOutside.status === 200 || poutOutside.status === 201) {
    console.log('✅ PASS: Punch Out outside radius succeeded (radius check bypassed).');
  } else {
    console.error('❌ FAIL: Punch Out outside radius failed.');
    process.exitCode = 1;
  }
  console.log('');

  // 2. Log in as Admin
  console.log('Logging in as admin (admin@sharpkode.com)...');
  const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@sharpkode.com',
      password: 'Admin@SharpKode2026',
      role_type: 'admin'
    })
  });

  const adminLoginData = await adminLoginRes.json();
  if (!adminLoginRes.ok) {
    console.error('Failed to log in as admin:', adminLoginData);
    process.exit(1);
  }
  const adminToken = adminLoginData.data.accessToken;
  console.log('Admin logged in successfully.\n');

  // Test Duplicate Phone Number check when creating employee
  console.log('Testing Create Employee with Duplicate Phone Number...');
  const newEmpRes = await fetch(`${baseUrl}/employees`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      name: 'Duplicate Phone Tester',
      email: `test_dup_${Date.now()}@sharpkode.com`,
      phone: '+910000000002', // Already registered by rahulmarketing@sharpkode.com
      role: 'EMPLOYEE',
      department: 'DEVELOPMENT',
      dob: '1996-05-15',
      joinDate: '2026-06-01',
      autoGeneratePassword: true
    })
  });

  const newEmpData = await newEmpRes.json();
  console.log(`Status: ${newEmpRes.status}`);
  console.log('Response:', newEmpData);
  if (newEmpRes.status === 409 && newEmpData.message.includes('Phone number already exists')) {
    console.log('✅ PASS: Create Employee duplicate phone number validation correctly rejected with 409.');
  } else {
    console.error('❌ FAIL: Create Employee duplicate phone did not return 409 with correct message.');
    process.exitCode = 1;
  }
  console.log('');

  console.log('==================================================');
  console.log('ATTENDANCE & PHONE DUPLICATE TESTS COMPLETED');
  console.log('==================================================\n');
};

runTests().catch(console.error);
