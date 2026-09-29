export const sendSuccess = (res, statusCode, message, data = null) => {
  const payload = {
    success: true,
    message
  };

  if (data !== null) {
    payload.data = data;
  }

  return res.status(statusCode).json(payload);
};

export const sendTokenResponse = (
  res,
  statusCode,
  message,
  accessToken,
  refreshToken,
  user
) =>
  res.status(statusCode).json({
    success: true,
    message,
    data: {
      token: accessToken,
      accessToken,
      refreshToken,
      role: user.role,
      user
    }
  });
