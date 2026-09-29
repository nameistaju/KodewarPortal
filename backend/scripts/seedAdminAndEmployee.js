import 'dotenv/config';
import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore if unable to set DNS servers
}
import { connectDB, disconnectDB } from '../src/config/db.js';
import Employee from '../src/models/Employee.js';
import { ROLES, DEPARTMENTS, EMPLOYEE_STATUS } from '../src/constants/index.js';

const parseDateDDMMYYYY = (dateStr) => {
  const [day, month, year] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const run = async () => {
  try {
    await connectDB();

    // Check if admin exists
    const adminEmail = 'admin@sharpkode.com';
    const existingAdmin = await Employee.findOne({ email: adminEmail });

    if (!existingAdmin) {
      const adminDOB = parseDateDDMMYYYY('08-12-2003');
      await Employee.create({
        name: 'SharpKode Admin',
        email: adminEmail,
        password: 'Admin@SharpKode2026',
        role: ROLES.ADMIN,
        department: DEPARTMENTS.ADMIN,
        status: EMPLOYEE_STATUS.ACTIVE,
        phone: '7396668037',
        dob: adminDOB,
        mustChangePassword: false,
        forcePasswordChange: false
      });
      console.log('Admin created');
    } else {
      console.log('Admin already exists');
    }

    // Check if employee exists
    const employeeEmail = 'rahulmarketing@sharpkode.com';
    const existingEmployee = await Employee.findOne({ email: employeeEmail });

    if (!existingEmployee) {
      await Employee.create({
        name: 'Rahul Test',
        email: employeeEmail,
        password: 'Employee@SharpKode2026',
        role: ROLES.EMPLOYEE,
        department: DEPARTMENTS.MARKETING,
        status: EMPLOYEE_STATUS.ACTIVE,
        phone: '8888888888',
        dob: new Date('1995-01-01'),
        mustChangePassword: false,
        forcePasswordChange: false
      });
      console.log('Employee created');
    } else {
      console.log('Employee already exists');
    }
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
    process.exit();
  }
};

run();
