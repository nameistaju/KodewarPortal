import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    employeeEmail: {
      type: String,
      required: true,
      trim: true
    },
    action: {
      type: String,
      required: true,
      default: 'Password Reset'
    },
    adminEmail: {
      type: String,
      required: function() {
        return this.operatorType === 'USER';
      },
      trim: true
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      index: true
    },
    attendanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attendance',
      index: true
    },
    reason: {
      type: String,
      trim: true
    },
    operatorType: {
      type: String,
      enum: ['USER', 'SYSTEM'],
      default: 'USER',
      required: true
    }
  },
  { timestamps: true }
);

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
