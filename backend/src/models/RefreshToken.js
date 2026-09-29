import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true
    },
    jti: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    tokenHash: {
      type: String,
      required: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }
    },
    revokedAt: Date,
    replacedByJti: String,
    ipAddress: String,
    userAgent: String
  },
  { timestamps: true }
);

refreshTokenSchema.index({ employee: 1, revokedAt: 1, expiresAt: 1 });

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

export default RefreshToken;
