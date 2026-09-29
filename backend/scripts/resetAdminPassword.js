import 'dotenv/config';
import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
import { connectDB, disconnectDB } from '../src/config/db.js';
import Employee from '../src/models/Employee.js';

const resetPassword = async () => {
  try {
    await connectDB();

    const admin = await Employee.findOne({ email: 'admin@sharpkode.com' });

    if (!admin) {
      console.error('Admin user not found in the database');
      await disconnectDB();
      process.exit(1);
    }

    admin.password = 'Admin@SharpKode2026';
    admin.forcePasswordChange = false;
    admin.mustChangePassword = false;
    
    await admin.save();

    console.log('Admin password reset successfully');
    await disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error('Failed to reset admin password:', error.message);
    process.exit(1);
  }
};

resetPassword();
