import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 180
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 5000
    },
    isPinned: {
      type: Boolean,
      default: false,
      index: true
    },
    priority: {
      type: String,
      enum: ['Urgent', 'Important', 'General'],
      default: 'General',
      index: true
    },
    visibleFrom: {
      type: Date,
      default: Date.now,
      index: true
    },
    visibleUntil: Date,
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

announcementSchema.index({ isPinned: -1, visibleFrom: -1 });

const Announcement = mongoose.model('Announcement', announcementSchema);

export default Announcement;
