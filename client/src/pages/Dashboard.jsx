import { useEffect, useState, useCallback } from "react"
import EmployeeDashboard from "../components/EmployeeDashboard"
import AdminDashboard from "../components/AdminDashboard"
import api from "../api/axios"
import { toastError, unwrap } from "../api/helpers"
import { useAuth } from "../context/AuthContext"

const defaultEmployeeData = {
  attendanceStatus: { attendance: null },
  leaveBalance: [
    { leaveType: "CASUAL", allocatedDays: 10, availableDays: 10 },
    { leaveType: "SICK", allocatedDays: 10, availableDays: 10 },
    { leaveType: "ANNUAL", allocatedDays: 10, availableDays: 10 }
  ],
  announcements: []
}

const defaultAdminData = {
  totalEmployees: 0,
  presentToday: 0,
  absentToday: 0,
  onLeaveToday: 0,
  pendingLeaves: 0,
  todayAttendance: []
}

const Dashboard = () => {
  const { user, token } = useAuth()
  const [data, setData] = useState(null)

  const fetchDashboard = useCallback(async () => {
    if (!token || !user) return;
    try {
      const endpoint = user.role === "ADMIN" ? "/dashboard/admin" : "/dashboard/employee";
      const res = await api.get(endpoint);
      setData(unwrap(res).dashboard);
    } catch (err) {
      toastError(err);
    }
  }, [token, user]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const activeData = data || (user?.role === "ADMIN" ? defaultAdminData : defaultEmployeeData);

  return user?.role === "ADMIN"
    ? <AdminDashboard data={activeData} refetch={fetchDashboard} />
    : <EmployeeDashboard data={activeData} user={user} refetch={fetchDashboard} />
}

export default Dashboard
