import mongoose from 'mongoose';

export const TEAM_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE'
});

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      minlength: 2,
      maxlength: 120
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ''
    },
    status: {
      type: String,
      enum: Object.values(TEAM_STATUS),
      default: TEAM_STATUS.ACTIVE,
      index: true
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
  { timestamps: true }
);

teamSchema.index({ name: 'text', description: 'text' });
teamSchema.index({ status: 1, name: 1 });

const Team = mongoose.model('Team', teamSchema);

export default Team;
