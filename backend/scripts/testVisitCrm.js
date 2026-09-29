import 'dotenv/config';
import { connectDB, disconnectDB } from '../src/config/db.js';
import Employee from '../src/models/Employee.js';
import ClientVisit from '../src/models/ClientVisit.js';

const baseUrl = 'http://localhost:5000/api';

const runTests = async () => {
  // 1. Connect to DB to perform clean up
  console.log('Connecting to database for test setup...');
  await connectDB();

  const employee = await Employee.findOne({ email: 'rahulmarketing@sharpkode.com' });
  if (!employee) {
    console.error('Test employee not found. Seed first.');
    await disconnectDB();
    process.exit(1);
  }

  console.log(`Cleaning up in-progress client visits for ${employee.email}...`);
  await ClientVisit.deleteMany({ employee: employee._id, status: 'IN_PROGRESS' });
  console.log('Cleaned up. Disconnecting from database...');
  await disconnectDB();

  console.log('\n=========================================');
  console.log('STARTING CLIENT VISIT CRM WORKFLOW TESTS');
  console.log('=========================================\n');

  // 2. Log in as employee
  console.log('Logging in as employee (rahulmarketing@sharpkode.com)...');
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'rahulmarketing@sharpkode.com',
      password: 'NkwZhNXefYuKAa1!',
      role_type: 'employee'
    })
  });

  const loginData = await loginRes.json();
  if (!loginRes.ok) {
    console.error('Failed to log in as employee:', loginData);
    process.exit(1);
  }
  const token = loginData.data.accessToken;
  console.log('Employee logged in successfully.\n');

  // 3. Start a new visit
  console.log('Starting a new marketing client visit...');
  const startRes = await fetch(`${baseUrl}/client-visits/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      businessName: 'Global Tech Solutions',
      ownerName: 'Alice Johnson',
      phone: '9876543210',
      email: 'alice@globaltech.com',
      industry: 'Software development',
      website: 'www.globaltech.com',
      visitPurpose: 'Product Demo & Proposal Pitch',
      address: 'VSP Tech Park, Visakhapatnam',
      latitude: 17.7283,
      longitude: 83.3145
    })
  });

  const startData = await startRes.json();
  console.log(`Start Visit Status: ${startRes.status}`);
  console.log('Start Visit Response:', startData);

  if (startRes.status === 201 && startData.success) {
    console.log('✅ PASS: Client visit started successfully.');
  } else {
    console.error('❌ FAIL: Start client visit failed.');
    process.exit(1);
  }
  const visitId = startData.data.visit.status === 'IN_PROGRESS' ? startData.data.visit._id : null;
  console.log('');

  if (!visitId) {
    console.error('❌ FAIL: No active visit ID returned.');
    process.exit(1);
  }

  // 4. Send GPS route update
  console.log(`Sending GPS route tracking update for visit ${visitId}...`);
  const routeRes = await fetch(`${baseUrl}/client-visits/${visitId}/route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      latitude: 17.7291,
      longitude: 83.3150
    })
  });

  const routeData = await routeRes.json();
  console.log(`Route Update Status: ${routeRes.status}`);
  console.log('Route Update Response:', routeData);
  if (routeRes.status === 200 && routeData.success) {
    console.log('✅ PASS: Route point successfully tracked.');
  } else {
    console.error('❌ FAIL: Route point update failed.');
    process.exit(1);
  }
  console.log('');

  // 5. Complete visit with evidence photos
  console.log(`Completing visit ${visitId} with photo attachments...`);
  const formData = new FormData();
  formData.append('leadStatus', 'Hot Lead');
  formData.append('servicesDiscussed', 'SharpKode Cloud Platform & AI Assistants');
  formData.append('notes', 'Alice was very impressed. Requested a detailed commercial proposal by Friday.');
  formData.append('followUpDate', new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString());

  // Attach dummy image buffers with valid JPEG signature (FF D8 FF)
  const dummyJpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const storefrontBlob = new Blob([dummyJpgBuffer], { type: 'image/jpeg' });
  const businessBlob = new Blob([dummyJpgBuffer], { type: 'image/jpeg' });
  
  formData.append('storefrontPhoto', storefrontBlob, 'storefront.jpg');
  formData.append('businessPhoto', businessBlob, 'business.jpg');

  const completeRes = await fetch(`${baseUrl}/client-visits/${visitId}/complete`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  const completeData = await completeRes.json();
  console.log(`Complete Visit Status: ${completeRes.status}`);
  console.log('Complete Visit Response:', completeData);
  if (completeRes.status === 200 && completeData.success) {
    console.log('✅ PASS: Client visit completed successfully with evidence photos uploaded.');
  } else {
    console.error('❌ FAIL: Complete client visit failed.');
    process.exit(1);
  }
  console.log('');

  console.log('=========================================');
  console.log('CLIENT VISIT CRM WORKFLOW TESTS COMPLETED');
  console.log('=========================================');
};

runTests().catch(err => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
