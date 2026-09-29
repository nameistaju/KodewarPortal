import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Attendance from '../src/models/Attendance.js';
import Employee from '../src/models/Employee.js';
import FieldTrackingSession from '../src/models/FieldTrackingSession.js';
import ClientVisit from '../src/models/ClientVisit.js';
import { startOfDay } from '../src/utils/date.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const employees = await Employee.find({ email: /employee/i });
  console.log('Found employees:', employees.map(e => e.email));

  const today = startOfDay();
  for (const employee of employees) {
    const deletedAttendance = await Attendance.deleteMany({ employee: employee._id, date: today });
    const deletedTracking = await FieldTrackingSession.deleteMany({ employee: employee._id });
    const deletedVisits = await ClientVisit.deleteMany({ employee: employee._id });

    console.log(`Deleted for ${employee.email}:`, {
      attendance: deletedAttendance.deletedCount,
      tracking: deletedTracking.deletedCount,
      visits: deletedVisits.deletedCount
    });
  }

  await mongoose.disconnect();
}

run();
