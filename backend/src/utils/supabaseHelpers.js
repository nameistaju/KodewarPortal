import bcrypt from 'bcrypt';

export const mapEmployeeFromDb = (row) => {
  if (!row) return null;

  const roleUpper = (row.role || 'employee').toUpperCase();

  let cleanDesignation = row.designation || 'Staff';
  let profilePhoto = null;

  if (row.designation && row.designation.includes('||')) {
    const [desig, photoUrl, publicId] = row.designation.split('||');
    cleanDesignation = desig || 'Staff';
    if (photoUrl) {
      profilePhoto = {
        url: photoUrl,
        publicId: publicId || ''
      };
    }
  }

  return {
    _id: String(row.id),
    id: String(row.id),
    employeeCode: row.employee_code || `EMP-${String(row.id).slice(-4)}`,
    name: row.name || 'Employee',
    email: row.email || '',
    department: row.department || 'GENERAL',
    designation: cleanDesignation,
    profilePhoto,
    profilePhotoUrl: profilePhoto?.url || null,
    avatar: profilePhoto?.url || null,
    role: roleUpper,
    status: row.is_active !== false ? 'ACTIVE' : 'INACTIVE',
    joinDate: row.joining_date || row.created_at || new Date().toISOString(),
    joiningDate: row.joining_date || row.created_at || new Date().toISOString(),
    tracksAttendance: roleUpper === 'EMPLOYEE',
    forcePasswordChange: false,
    mustChangePassword: false,
    leaveBalances: [
      { leaveType: 'CASUAL', allocatedDays: 12, availableDays: row.leave_balance_casual ?? 12 },
      { leaveType: 'SICK', allocatedDays: 12, availableDays: row.leave_balance_sick ?? 12 }
    ],
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString()
  };
};

export const comparePassword = async (candidatePassword, hash) => {
  if (!candidatePassword || !hash) return false;
  return await bcrypt.compare(candidatePassword, hash);
};

export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};
