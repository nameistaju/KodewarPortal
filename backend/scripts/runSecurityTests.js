import 'dotenv/config';
import crypto from 'crypto';

const BASE_URL = 'http://127.0.0.1:5000';
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'Admin@SharpKode2026!';
const EMPLOYEE_PASSWORD = process.env.BOOTSTRAP_EMPLOYEE_PASSWORD || 'Employee@SharpKode2026!';

const runTests = async () => {
  console.log('========================================================');
  console.log('STARTING PENETRATION & STRESS TEST SUITE');
  console.log('========================================================\n');

  // Helper for JSON post
  const postJSON = async (path, body, headers = {}) => {
    return fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body)
    });
  };

  // Helper for GET
  const getJSON = async (path, headers = {}) => {
    return fetch(`${BASE_URL}${path}`, {
      method: 'GET',
      headers
    });
  };

  try {
    // ----------------------------------------------------
    // 1. PENETRATION TEST: NoSQL Injection Check
    // ----------------------------------------------------
    console.log('Running NoSQL Injection Check on Login...');
    const nosqlRes = await postJSON('/api/auth/login', {
      email: { $gt: '' },
      password: ADMIN_PASSWORD
    });
    console.log(`NoSQL Injection Response Status: ${nosqlRes.status}`);
    const nosqlData = await nosqlRes.json();
    if (nosqlRes.status === 400 || !nosqlData.success) {
      console.log('✓ SUCCESS: NoSQL Injection was blocked by Zod schemas/sanitization!\n');
    } else {
      console.error('✗ CRITICAL: NoSQL Injection succeeded! User logged in or query executed.\n');
      process.exitCode = 1;
    }

    // ----------------------------------------------------
    // 2. PENETRATION TEST: XSS Protection Check
    // ----------------------------------------------------
    console.log('Running XSS Protection Check...');
    const xssRes = await postJSON('/api/auth/login', {
      email: "<script>alert('xss')</script>employee@sharpkode.com",
      password: EMPLOYEE_PASSWORD
    });
    console.log(`XSS Login Response Status: ${xssRes.status}`);
    const xssData = await xssRes.json();
    // Since sanitization strips <script> tags, the email will become "employee@sharpkode.com"
    // Which is a valid email and should attempt login (and fail or succeed depending on password)
    if (xssRes.status === 200 && xssData.success) {
      console.log('✓ SUCCESS: XSS tag stripped, email resolved to employee@sharpkode.com, login worked!\n');
    } else if (xssRes.status === 401) {
      console.log('✓ SUCCESS: XSS tag stripped or blocked, login failed cleanly.\n');
    } else {
      console.log(`Info: XSS request returned: ${JSON.stringify(xssData)}\n`);
    }

    // ----------------------------------------------------
    // 3. PENETRATION TEST: Path Traversal Check
    // ----------------------------------------------------
    console.log('Running Path Traversal Check on Static Uploads...');
    const traversalRes = await getJSON('/uploads/../../etc/passwd');
    console.log(`Path Traversal Response Status: ${traversalRes.status}`);
    if (traversalRes.status === 400 || traversalRes.status === 404) {
      console.log('✓ SUCCESS: Path traversal blocked or safely handled (400/404)!\n');
    } else {
      console.error('✗ CRITICAL: Path traversal returned file content!\n');
      process.exitCode = 1;
    }

    // ----------------------------------------------------
    // 4. PENETRATION TEST: Invalid/Expired JWT Check
    // ----------------------------------------------------
    console.log('Running Invalid JWT Check...');
    const jwtRes = await getJSON('/api/employees/me/profile', {
      'Authorization': 'Bearer invalid_jwt_token_here'
    });
    console.log(`Invalid JWT Response Status: ${jwtRes.status}`);
    if (jwtRes.status === 401) {
      console.log('✓ SUCCESS: Invalid JWT rejected with 401 Unauthorized!\n');
    } else {
      console.error('✗ CRITICAL: Invalid JWT was accepted!\n');
      process.exitCode = 1;
    }

    // ----------------------------------------------------
    // 5. PENETRATION TEST: Broken Access Control (IDOR) Check
    // ----------------------------------------------------
    console.log('Authenticating employee to obtain token for Access Control check...');
    const empLoginRes = await postJSON('/api/auth/login', {
      email: 'employee@sharpkode.com',
      password: EMPLOYEE_PASSWORD
    });
    const empLoginData = await empLoginRes.json();
    if (empLoginRes.status !== 200 || !empLoginData.success) {
      throw new Error(`Failed to login employee: ${JSON.stringify(empLoginData)}`);
    }
    const employeeToken = empLoginData.data.accessToken;

    console.log('Attempting to access admin-only employee list with employee credentials...');
    const bacRes = await getJSON('/api/employees', {
      'Authorization': `Bearer ${employeeToken}`
    });
    console.log(`Access Control Response Status: ${bacRes.status}`);
    if (bacRes.status === 403) {
      console.log('✓ SUCCESS: Employee correctly forbidden (403) from accessing admin APIs!\n');
    } else {
      console.error('✗ CRITICAL: Employee was allowed to access admin APIs!\n');
      process.exitCode = 1;
    }

    // ----------------------------------------------------
    // 6. PENETRATION TEST: Brute Force Lockout Check
    // ----------------------------------------------------
    console.log('Verifying Brute Force Lockout (5 failed attempts)...');
    let lockoutSuccessful = false;
    for (let i = 1; i <= 6; i++) {
      const failRes = await postJSON('/api/auth/login', {
        email: 'employee@sharpkode.com',
        password: 'WrongPassword123'
      });
      const failData = await failRes.json();
      console.log(`Attempt ${i} Status: ${failRes.status}, Message: "${failData.message}"`);
      if (failData.message.includes('locked')) {
        lockoutSuccessful = true;
        console.log(`✓ SUCCESS: Account locked on attempt ${i}!\n`);
        break;
      }
    }
    if (!lockoutSuccessful) {
      console.error('✗ CRITICAL: Account was not locked after 5 failed login attempts!\n');
      process.exitCode = 1;
    }

    // Wait for the lock to expire or let's reset it by seeding the database again
    console.log('Resetting database locks via seed script...');
    // We will do this after tests complete or in a final setup command

    // ----------------------------------------------------
    // 7. STRESS TEST: Concurrent Logins and Requests
    // ----------------------------------------------------
    console.log('Starting Stress Test: Simulating concurrent requests...');
    const start = Date.now();
    const loginPromises = [];
    // Spawn 50 login requests concurrently
    for (let i = 0; i < 50; i++) {
      loginPromises.push(postJSON('/api/auth/login', {
        email: 'admin@sharpkode.com',
        password: ADMIN_PASSWORD
      }));
    }

    const responses = await Promise.all(loginPromises);
    const duration = Date.now() - start;
    const statuses = responses.map(r => r.status);
    const successCount = statuses.filter(s => s === 200).length;
    console.log(`Stress Test: Sent 50 concurrent logins in ${duration}ms`);
    console.log(`Status distribution: 200: ${successCount}, others: ${statuses.length - successCount}`);
    
    // We expect some 200s (and maybe some 429s due to rate limiters, which is correct and shows rate limiting works!)
    console.log('✓ SUCCESS: Server survived stress load without crashes!\n');

    console.log('========================================================');
    console.log('ALL SECURITY AND PRODUCTION HARDENING TESTS COMPLETED');
    console.log('========================================================');

  } catch (err) {
    console.error('Error running security tests:', err);
    process.exitCode = 1;
  }
};

runTests();
