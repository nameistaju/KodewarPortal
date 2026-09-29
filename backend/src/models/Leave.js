import mongoose from 'mongoose';
import { LEAVE_TYPES, REQUEST_STATUS } from '../constants/index.js';

const leaveSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true
    },
    leaveType: {
      type: String,
      enum: Object.values(LEAVE_TYPES),
      required: true
    },
    startDate: {
      type: Date,
      required: true,
      index: true
    },
    endDate: {
      type: Date,
      required: true
    },
    totalDays: {
      type: Number,
      required: true,
      min: 0.5
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 1000
    },
    status: {
      type: String,
      enum: Object.values(REQUEST_STATUS),
      default: REQUEST_STATUS.PENDING,
      index: true
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    reviewedAt: Date,
    reviewRemarks: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    cancelledAt: Date,
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 500
    }
  },
  { timestamps: true }
);

leaveSchema.index({ employee: 1, startDate: -1 });
leaveSchema.index({ status: 1, startDate: 1, endDate: 1 });
leaveSchema.index(
  { employee: 1, startDate: 1, endDate: 1, leaveType: 1, status: 1 },
  {
    name: 'uniq_pending_leave_range',
    unique: true,
    partialFilterExpression: { status: REQUEST_STATUS.PENDING }
  }
);

leaveSchema.pre('validate', function validateDateRange() {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    this.invalidate('endDate', 'End date must be greater than or equal to start date');
  }
});

const Leave = mongoose.model('Leave', leaveSchema);

export default Leave;
