import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { DEPARTMENTS, EMPLOYEE_STATUS, LEAVE_TYPES, ROLES } from '../constants/index.js';

const photoSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true },
    publicId: { type: String, trim: true }
  },
  { _id: false }
);

const leaveBalanceSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: Object.values(LEAVE_TYPES),
      required: true
    },
    allocated: { type: Number, default: 0, min: 0 },
    used: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const employeeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: [/^[0-9+\-\s()]{7,20}$/, 'Please provide a valid phone number']
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email']
    },
    department: {
      type: String,
      required: true,
      enum: Object.values(DEPARTMENTS)
    },
    dob: {
      type: Date,
      required: true
    },
    joinDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    profilePhoto: photoSchema,
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.EMPLOYEE,
      index: true
    },
    tracksAttendance: {
      type: Boolean,
      default: function() {
        return this.role === ROLES.EMPLOYEE;
      }
    },
    status: {
      type: String,
      enum: Object.values(EMPLOYEE_STATUS),
      default: EMPLOYEE_STATUS.ACTIVE,
      index: true
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false
    },
    forcePasswordChange: {
      type: Boolean,
      default: true
    },
    mustChangePassword: {
      type: Boolean,
      default: true
    },
    passwordChangedAt: Date,
    passwordResetToken: {
      type: String,
      select: false
    },
    passwordResetExpires: {
      type: Date,
      select: false
    },
    tokenVersion: {
      type: Number,
      default: 0,
      select: false
    },
    loginAttempts: {
      type: Number,
      default: 0,
      select: false
    },
    lockUntil: {
      type: Date,
      select: false
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
      index: true
    },
    assignedClients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client'
      }
    ],
    leaveBalances: {
      type: [leaveBalanceSchema],
      default: () =>
        Object.values(LEAVE_TYPES).map((type) => ({
          type,
          allocated: type === LEAVE_TYPES.ANNUAL ? 12 : 6,
          used: 0
        }))
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.tokenVersion;
        return ret;
      }
    }
  }
);

employeeSchema.index({ name: 'text', email: 'text', department: 'text' });
employeeSchema.index({ department: 1, status: 1 });

employeeSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;

  this.password = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = new Date();
});

employeeSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

employeeSchema.methods.createPasswordResetToken = function createPasswordResetToken() {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);

  return resetToken;
};

employeeSchema.methods.changedPasswordAfter = function changedPasswordAfter(jwtIssuedAt) {
  if (!this.passwordChangedAt) return false;

  const changedTimestamp = Math.floor(this.passwordChangedAt.getTime() / 1000);
  return changedTimestamp > jwtIssuedAt;
};

const Employee = mongoose.model('Employee', employeeSchema);

export default Employee;


