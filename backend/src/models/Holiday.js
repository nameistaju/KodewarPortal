import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 160
    },
    date: {
      type: Date,
      required: true,
      unique: true,
      index: true
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500
    },
    isOptional: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    }
  },
  { timestamps: true }
);

const Holiday = mongoose.model('Holiday', holidaySchema);

export default Holiday;
