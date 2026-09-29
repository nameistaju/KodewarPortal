import mongoose from 'mongoose';

const coordinatesSchema = new mongoose.Schema(
  {
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    distanceFromOfficeMeters: { type: Number, min: 0 },
    accuracy: { type: Number, min: 0 }
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true
    },
    date: {
      type: Date,
      required: true,
      index: true
    },
    punchIn: {
      time: Date,
      location: coordinatesSchema,
      deviceInfo: String
    },
    punchOut: {
      time: Date,
      location: coordinatesSchema,
      deviceInfo: String
    },
    workingHours: {
      type: Number,
      default: 0,
      min: 0
    },
    attendanceStatus: {
      type: String,
      enum: ['ABSENT', 'PUNCHED_IN', 'PUNCHED_OUT'],
      default: 'ABSENT',
      index: true
    },
    isAutoClosed: {
      type: Boolean,
      default: false
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500
    }
  },
  { timestamps: true }
);

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });
attendanceSchema.index(
  { employee: 1, attendanceStatus: 1 },
  { name: 'uniq_open_attendance_per_employee', unique: true, partialFilterExpression: { attendanceStatus: 'PUNCHED_IN' } }
);
attendanceSchema.index({ date: 1, 'punchIn.time': 1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance;
