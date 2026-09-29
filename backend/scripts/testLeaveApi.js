// Using native global fetch

const baseUrl = 'http://localhost:5000/api';

const runApiTests = async () => {
  console.log('\n==================================================');
  console.log('STARTING LEAVE API E2E ROUTE TESTS');
  console.log('==================================================\n');

  // Log in as employee
  console.log('Logging in as rahulmarketing@sharpkode.com...');
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
    console.error('Failed to log in:', loginData);
    return;
  }

  const token = loginData.data.accessToken;
  console.log('Logged in successfully. Access token received.\n');

  // Helper to send post request
  const applyLeave = async (payload, customToken = token) => {
    const res = await fetch(`${baseUrl}/leaves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customToken}`
      },
      body: JSON.stringify(payload)
    });
    return {
      status: res.status,
      data: await res.json()
    };
  };

  // Clean up existing leaves first by calling DB or letting it overlap
  // Since we already ran the DB test script, there is one valid leave from 2026-07-10 to 2026-07-11.

  // SCENARIO 1: Create a leave successfully
  // Let's use a different date to avoid overlap with existing one
  console.log('--- Scenario 1: Create a leave successfully ---');
  const s1 = await applyLeave({
    leaveType: 'SICK',
    startDate: '2026-08-20',
    endDate: '2026-08-21',
    reason: 'Fever recovery in August'
  });
  console.log(`Status: ${s1.status}`);
  console.log('Response:', s1.data);
  console.log('');

  // SCENARIO 2: Create a leave with invalid dates (end date before start date)
  console.log('--- Scenario 2: Create a leave with invalid dates ---');
  const s2 = await applyLeave({
    leaveType: 'SICK',
    startDate: '2026-08-25',
    endDate: '2026-08-24', // End before start
    reason: 'Should fail validation'
  });
  console.log(`Status: ${s2.status}`);
  console.log('Response:', s2.data);
  console.log('');

  // SCENARIO 3: Create a leave with invalid leave type
  console.log('--- Scenario 3: Create a leave with invalid leave type ---');
  const s3 = await applyLeave({
    leaveType: 'MATERNITY', // Invalid enum
    startDate: '2026-08-25',
    endDate: '2026-08-26',
    reason: 'Should fail validation'
  });
  console.log(`Status: ${s3.status}`);
  console.log('Response:', s3.data);
  console.log('');

  // SCENARIO 4: Create a leave exceeding balance
  console.log('--- Scenario 4: Create a leave exceeding balance ---');
  const s4 = await applyLeave({
    leaveType: 'SICK',
    startDate: '2026-09-01',
    endDate: '2026-09-15', // 15 days (limit 6)
    reason: 'Exceeding balance limits'
  });
  console.log(`Status: ${s4.status}`);
  console.log('Response:', s4.data);
  console.log('');

  // SCENARIO 5: Create overlapping leave requests
  console.log('--- Scenario 5: Create overlapping leave requests ---');
  const s5 = await applyLeave({
    leaveType: 'CASUAL',
    startDate: '2026-08-19', // Overlaps with 2026-08-20 to 2026-08-21
    endDate: '2026-08-20',
    reason: 'Overlapping request'
  });
  console.log(`Status: ${s5.status}`);
  console.log('Response:', s5.data);
  console.log('');

  // SCENARIO 6: Create leave with missing/invalid employee context (Invalid Token -> 401)
  console.log('--- Scenario 6: Create leave with missing/invalid employee context ---');
  const s6 = await applyLeave({
    leaveType: 'SICK',
    startDate: '2026-08-28',
    endDate: '2026-08-29',
    reason: 'Invalid token'
  }, 'invalid-token-value');
  console.log(`Status: ${s6.status}`);
  console.log('Response:', s6.data);
  console.log('');

  console.log('==================================================');
  console.log('API TESTS COMPLETED');
  console.log('==================================================\n');
};

runApiTests().catch(console.error);
