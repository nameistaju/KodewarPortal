import { supabase } from '../config/supabase.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import { verifyToken } from '../utils/jwt.js';
import { mapEmployeeFromDb } from '../utils/supabaseHelpers.js';

const getTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  return null;
};

export const protect = catchAsync(async (req, _res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return next(new AppError('Authentication token is required', 401));
  }

  const decoded = verifyToken(token);

  if (decoded.type !== 'access') {
    return next(new AppError('Invalid authentication token type', 401));
  }

  const { data: userRow, error } = await supabase
    .from('employees')
    .select('*')
    .eq('id', decoded.sub)
    .single();

  if (error || !userRow) {
    return next(new AppError('User belonging to this token no longer exists', 401));
  }

  if (userRow.is_active === false) {
    return next(new AppError('This account is inactive', 403));
  }

  const user = mapEmployeeFromDb(userRow);
  req.user = user;
  next();
});
