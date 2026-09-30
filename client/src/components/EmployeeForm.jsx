import React, { useState, useEffect } from "react";
import { DEPARTMENTS } from "../assets/assets";
import { 
  Loader2Icon, EyeIcon, EyeOffIcon, CheckIcon, CopyIcon, 
  LockIcon, RefreshCwIcon, User, Calendar, FileText, XIcon,
  Shield, Info, ClipboardList, KeyIcon, LogOutIcon
} from "lucide-react"
import api from "../api/axios"
import toast from "react-hot-toast"
import { toastError, unwrapItems } from "../api/helpers"
import { generateSecurePassword } from "../utils/passwordGenerator"

const EmployeeForm = ({ initialData, onSuccess, onCancel, onSuccessStateChange }) => {
  const [loading, setLoading] = useState(false)
  const [teams, setTeams] = useState([])
  const isEditMode = !!initialData;

  // Tabs control in edit mode
  const [activeTab, setActiveTab] = useState("profile"); // profile, attendance, leave, security

  // Role & Form State
  const [nameVal, setNameVal] = useState(initialData?.name || "");
  const [emailVal, setEmailVal] = useState(initialData?.email || "");
  const [phoneVal, setPhoneVal] = useState(initialData?.phone || "");
  const [dobVal, setDobVal] = useState(initialData?.dob ? new Date(initialData.dob).toISOString().split("T")[0] : "");
  const [joinDateVal, setJoinDateVal] = useState(initialData?.joinDate ? new Date(initialData.joinDate).toISOString().split("T")[0] : "");
  const [departmentVal, setDepartmentVal] = useState(initialData?.department || "");
  const [roleVal, setRoleVal] = useState(initialData?.role || "EMPLOYEE");
  const [teamIdVal, setTeamIdVal] = useState(initialData?.teamId?._id || initialData?.teamId || "");
  const [tracksAttendanceVal, setTracksAttendanceVal] = useState(initialData?.tracksAttendance ?? true);

  // Profile photo state
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(initialData?.profilePhoto?.url || initialData?.avatar || null);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG, PNG, and WEBP images are allowed.');
      e.target.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be less than 10MB.');
      e.target.value = '';
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  // Single password source of truth for creation mode / edit mode password change
  const [passwordVal, setPasswordVal] = useState(() => isEditMode ? "" : generateSecurePassword());
  const [showPassword, setShowPassword] = useState(false);
  const [showSuccessPassword, setShowSuccessPassword] = useState(false);

  // Touched states for inline validations
  const [touched, setTouched] = useState({});

  // Edit Mode Security & History States
  const [changePassword, setChangePassword] = useState(false);
  const [confirmPasswordVal, setConfirmPasswordVal] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forceChange, setForceChange] = useState(initialData?.forcePasswordChange ?? true);
  const [securityInfo, setSecurityInfo] = useState(null);
  const [loadingSecurity, setLoadingSecurity] = useState(false);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  const [leaveHistory, setLeaveHistory] = useState([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);

  // Success State
  const [successData, setSuccessData] = useState(null);
  const [copied, setCopied] = useState(false);

  // Role visibility flags
  const currentRole = (roleVal || "EMPLOYEE").toUpperCase();
  const isEmployee = currentRole === "EMPLOYEE";
  const isTeamLead = currentRole === "TEAM_LEAD";
  const isAdmin = currentRole === "ADMIN";

  const showPhone = isEditMode ? true : (isEmployee || isTeamLead);
  const showDob = isEditMode ? true : isEmployee;
  const showJoinDate = isEditMode ? true : !isAdmin;
  const showDepartment = isEditMode ? true : !isAdmin;
  const showTeam = isEditMode ? true : isEmployee;
  const showTracksAttendance = isEditMode ? true : isEmployee;

  // Notify parent component about success modal state (for non-dismissible lock)
  useEffect(() => {
    onSuccessStateChange?.(!!successData);
  }, [successData, onSuccessStateChange]);

  // Intercept ESC key when success modal is active
  useEffect(() => {
    if (successData) {
      const handleKeyDown = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
        }
      };
      window.addEventListener("keydown", handleKeyDown, true);
      return () => window.removeEventListener("keydown", handleKeyDown, true);
    }
  }, [successData]);

  // Fetch active teams
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const res = await api.get('/teams', { params: { status: 'ACTIVE', limit: 100, sort: 'name' } });
        setTeams(unwrapItems(res));
      } catch (err) {
        console.error('Failed to fetch teams:', err);
      }
    };
    fetchTeams();
  }, []);

  // Fetch security info (Edit mode)
  useEffect(() => {
    if (isEditMode && initialData?._id && activeTab === "security") {
      const fetchSecurity = async () => {
        setLoadingSecurity(true);
        try {
          const res = await api.get(`/employees/${initialData._id}/security`);
          setSecurityInfo(res.data.data);
        } catch (err) {
          console.error("Failed to fetch security info:", err);
        } finally {
          setLoadingSecurity(false);
        }
      };
      fetchSecurity();
    }
  }, [isEditMode, initialData?._id, activeTab, refetchTrigger]);

  // Fetch attendance history (Edit mode)
  useEffect(() => {
    if (isEditMode && initialData?._id && activeTab === "attendance") {
      const fetchAttendance = async () => {
        setLoadingAttendance(true);
        try {
          const res = await api.get(`/attendance/history?employeeId=${initialData._id}&limit=50`);
          setAttendanceHistory(res.data.data.items || []);
        } catch (err) {
          console.error("Failed to fetch attendance:", err);
        } finally {
          setLoadingAttendance(false);
        }
      };
      fetchAttendance();
    }
  }, [isEditMode, initialData?._id, activeTab]);

  // Fetch leave history (Edit mode)
  useEffect(() => {
    if (isEditMode && initialData?._id && activeTab === "leave") {
      const fetchLeaves = async () => {
        setLoadingLeaves(true);
        try {
          const res = await api.get(`/leaves?employeeId=${initialData._id}&limit=50`);
          setLeaveHistory(res.data.data.items || []);
        } catch (err) {
          console.error("Failed to fetch leaves:", err);
        } finally {
          setLoadingLeaves(false);
        }
      };
      fetchLeaves();
    }
  }, [isEditMode, initialData?._id, activeTab]);

  const handleResetPassword = async () => {
    if (!window.confirm("Are you sure you want to reset this employee's password? This will log them out of all active sessions.")) {
      return;
    }
    setLoading(true);
    try {
      const res = await api.post(`/employees/${initialData._id}/reset-password`, {});
      toast.success("Password reset successfully");
      setSuccessData({
        name: initialData.name,
        email: initialData.email,
        role: initialData.role || "EMPLOYEE",
        password: res.data.data.temporaryPassword
      });
      setRefetchTrigger(prev => prev + 1);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutAll = async () => {
    if (!window.confirm("Are you sure you want to log this employee out of all active sessions?")) {
      return;
    }
    setLoading(true);
    try {
      await api.post(`/employees/${initialData._id}/logout-all`, {});
      toast.success("Logged out from all devices");
      setRefetchTrigger(prev => prev + 1);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  // Inline Validation Helper
  const getFieldError = (field) => {
    if (isEditMode) return null;
    if (field === "name") {
      if (!nameVal.trim()) return "Full name is required";
      if (nameVal.trim().length < 2) return "Name must be at least 2 characters";
    }
    if (field === "email") {
      if (!emailVal.trim()) return "Work email is required";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal.trim())) return "Please enter a valid email address";
    }
    if (field === "phone" && showPhone) {
      if (!phoneVal.trim()) return "Phone number is required";
      if (!/^[0-9+\-\s()]{7,20}$/.test(phoneVal.trim())) return "Please enter a valid phone number (min 7 digits)";
    }
    if (field === "department" && showDepartment) {
      if (!departmentVal) return "Department is required";
    }
    if (field === "dob" && showDob) {
      if (!dobVal) return "Date of birth is required";
    }
    return null;
  };

  const isFormValid = !isEditMode ? (
    !getFieldError("name") &&
    !getFieldError("email") &&
    (!showPhone || !getFieldError("phone")) &&
    (!showDepartment || !getFieldError("department")) &&
    (!showDob || !getFieldError("dob")) &&
    passwordVal.length >= 8
  ) : true;

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEditMode && !isFormValid) return;

    setLoading(true);

    try {
      if (photoFile) {
        const formData = new FormData();
        formData.append("profilePhoto", photoFile);
        formData.append("name", nameVal.trim());
        formData.append("role", roleVal);
        if (emailVal) formData.append("email", emailVal.trim().toLowerCase());
        if (phoneVal) formData.append("phone", phoneVal);
        if (departmentVal) formData.append("department", departmentVal);
        if (dobVal) formData.append("dob", dobVal);
        if (joinDateVal) formData.append("joinDate", joinDateVal);
        if (teamIdVal) formData.append("teamId", teamIdVal);
        formData.append("tracksAttendance", tracksAttendanceVal);

        if (isEditMode) {
          formData.append("forcePasswordChange", forceChange);
          if (changePassword) {
            if (passwordVal !== confirmPasswordVal) {
              toast.error("Passwords do not match");
              setLoading(false);
              return;
            }
            if (passwordVal.length < 8) {
              toast.error("Password must be at least 8 characters long");
              setLoading(false);
              return;
            }
            formData.append("password", passwordVal);
          }

          await api.patch(`/employees/${initialData._id}`, formData);
          toast.success(changePassword ? "Password updated successfully" : "Employee updated successfully");
          onSuccess?.();
        } else {
          formData.append("password", passwordVal);

          const res = await api.post("/employees", formData);
          toast.success("Employee created successfully");

          const returnedPassword = res.data?.data?.generatedPassword || passwordVal;
          setSuccessData({
            name: nameVal.trim(),
            email: emailVal.trim().toLowerCase(),
            role: roleVal,
            password: returnedPassword
          });
        }
      } else if (isEditMode) {
        const payload = {
          name: nameVal,
          phone: phoneVal,
          department: departmentVal,
          role: roleVal,
          teamId: teamIdVal || null,
          tracksAttendance: tracksAttendanceVal,
          forcePasswordChange: forceChange
        };
        if (dobVal) payload.dob = dobVal;
        if (joinDateVal) payload.joinDate = joinDateVal;
        if (changePassword) {
          if (passwordVal !== confirmPasswordVal) {
            toast.error("Passwords do not match");
            setLoading(false);
            return;
          }
          if (passwordVal.length < 8) {
            toast.error("Password must be at least 8 characters long");
            setLoading(false);
            return;
          }
          payload.password = passwordVal;
        }

        await api.patch(`/employees/${initialData._id}`, payload);
        toast.success(changePassword ? "Password updated successfully" : "Employee updated successfully");
        onSuccess?.();
      } else {
        // Creation Mode: send explicit single password
        const payload = {
          name: nameVal.trim(),
          email: emailVal.trim().toLowerCase(),
          role: roleVal,
          password: passwordVal
        };

        if (showPhone && phoneVal.trim()) payload.phone = phoneVal.trim();
        if (showDob && dobVal) payload.dob = dobVal;
        if (showJoinDate && joinDateVal) payload.joinDate = joinDateVal;
        if (showDepartment && departmentVal) payload.department = departmentVal;
        if (showTeam && teamIdVal) payload.teamId = teamIdVal;
        if (showTracksAttendance) payload.tracksAttendance = tracksAttendanceVal;

        const res = await api.post("/employees", payload);
        toast.success("Employee created successfully");

        const returnedPassword = res.data?.data?.generatedPassword || passwordVal;
        setSuccessData({
          name: nameVal.trim(),
          email: emailVal.trim().toLowerCase(),
          role: roleVal,
          password: returnedPassword
        });
      }
    } catch (error) {
      toastError(error);
    } finally {
      setLoading(false);
    }
  };

  // SUCCESS DIALOG RENDER
  if (successData) {
    const handleCopyCredentials = () => {
      const formatted = `Employee Name: ${successData.name}\nEmail: ${successData.email}\nPassword: ${successData.password}`;
      navigator.clipboard.writeText(formatted);
      setCopied(true);
      toast.success("Credentials copied successfully.");
      setTimeout(() => setCopied(false), 2000);
    };

    const handleDone = () => {
      setNameVal("");
      setEmailVal("");
      setPhoneVal("");
      setDobVal("");
      setJoinDateVal("");
      setDepartmentVal("");
      setRoleVal("EMPLOYEE");
      setTeamIdVal("");
      setTouched({});
      setPasswordVal(generateSecurePassword());
      setSuccessData(null);
      onSuccessStateChange?.(false);
      onSuccess?.();
    };

    return (
      <div className="relative mx-auto max-w-lg space-y-4 p-5 text-left text-neutral-700 animate-fade-in sm:p-6 bg-white">
        <button type="button" onClick={handleDone} className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-bold text-black shadow-sm transition hover:bg-neutral-100 cursor-pointer" aria-label="Close employee credentials">
          <XIcon className="h-3.5 w-3.5" /> Close
        </button>
        <div className="flex items-start gap-3 pr-20">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-neutral-900 bg-black text-white shadow-sm">
            <CheckIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">Account ready</p>
            <h3 className="mt-1 text-lg font-black text-black">Employee created successfully</h3>
            <p className="mt-1 text-xs text-neutral-500 font-medium">Share these credentials securely before closing this window.</p>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-neutral-200 pb-3.5">
            <div>
              <span className="text-neutral-500 font-bold uppercase tracking-wider text-[10px] block">Employee Name</span>
              <span className="text-black font-extrabold text-sm mt-0.5 block">{successData.name}</span>
            </div>
            <div>
              <span className="text-neutral-500 font-bold uppercase tracking-wider text-[10px] block">System Role</span>
              <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-black text-white border border-neutral-900">
                {successData.role}
              </span>
            </div>
          </div>

          <div>
            <span className="text-neutral-500 font-bold uppercase tracking-wider text-[10px] block mb-1">Company Email</span>
            <span className="text-black font-semibold font-mono text-xs block bg-white p-2.5 rounded-xl border border-neutral-200">
              {successData.email}
            </span>
          </div>

          <div>
            <span className="text-neutral-500 font-bold uppercase tracking-wider text-[10px] block mb-1">Temporary Password</span>
            <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-neutral-200">
              <code className="text-black font-mono font-bold text-sm px-2 select-all">
                {showSuccessPassword ? successData.password : "••••••••••••••••"}
              </code>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowSuccessPassword(!showSuccessPassword)}
                  className="p-2 text-neutral-500 hover:text-black rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
                  title={showSuccessPassword ? "Hide Password" : "Show Password"}
                >
                  {showSuccessPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(successData.password);
                    toast.success("Password copied");
                  }}
                  className="px-3 py-1.5 bg-black hover:bg-neutral-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <CopyIcon size={14} />
                  <span>Copy</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-neutral-100 border border-neutral-300 text-black rounded-xl p-3.5 text-xs flex items-start gap-2.5">
            <Info className="w-4 h-4 text-black shrink-0 mt-0.5" />
            <span className="font-semibold leading-relaxed">
              This password is shown only once. Please copy and securely share it with the employee before closing this window.
            </span>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-neutral-200 pt-4 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={handleCopyCredentials}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-xs font-bold text-black shadow-sm transition hover:bg-neutral-100 cursor-pointer sm:min-w-44"
          >
            {copied ? <CheckIcon className="w-4 h-4 text-black" /> : <ClipboardList className="w-4 h-4 text-neutral-500" />}
            <span>{copied ? "Credentials Copied!" : "Copy Credentials"}</span>
          </button>

          <button
            type="button"
            onClick={handleDone}
            className="inline-flex items-center justify-center rounded-xl bg-black px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-neutral-800 cursor-pointer sm:min-w-32"
          >
            Done & Close
          </button>
        </div>
      </div>
    );
  }

  // TAB NAVIGATION (Edit mode)
  const tabItems = [
    { id: "profile", name: "Profile", icon: User },
    { id: "attendance", name: "Attendance Logs", icon: Calendar },
    { id: "leave", name: "Leave Balances", icon: FileText },
    { id: "security", name: "Security Settings", icon: Shield },
  ];

  const showFooter = !isEditMode || activeTab === "profile" || (activeTab === "security" && changePassword);

  const handleCancelClick = () => {
    if (isEditMode && activeTab === "security" && changePassword) {
      setChangePassword(false);
    } else {
      onCancel?.();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0 overflow-hidden bg-white text-neutral-800">
      {/* Tab bar (Edit Mode) */}
      {isEditMode && (
        <div className="flex items-center gap-1.5 border-b border-neutral-200 overflow-x-auto pb-px scrollbar-none bg-white px-6 py-2 shrink-0">
          {tabItems.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                  isActive ? "border-black text-black" : "border-transparent text-neutral-400 hover:text-black"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* PROFILE TAB CONTENT OR CREATE MODE */}
        {(activeTab === "profile" || !isEditMode) && (
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4 text-left">
              <div className="flex items-center pb-1.5 border-b border-neutral-200">
                <h3 className="font-black text-black text-xs uppercase tracking-wider">
                  Basic Information
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium">
                {/* Profile Photo File Upload */}
                <div className="flex items-center gap-4 p-4 rounded-2xl border border-neutral-200 bg-neutral-50 sm:col-span-2">
                  <div className="relative shrink-0">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Preview" className="w-14 h-14 rounded-2xl object-cover border border-neutral-300 shadow-xs" />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-black text-white font-extrabold flex items-center justify-center text-lg border border-neutral-800">
                        {nameVal ? nameVal.slice(0, 2).toUpperCase() : "EP"}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <label htmlFor="photoUpload" className="block text-xs font-bold text-black cursor-pointer">
                      Profile Photo (Cloudinary)
                    </label>
                    <input
                      id="photoUpload"
                      name="profilePhoto"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={loading}
                      onChange={handlePhotoChange}
                      className="w-full text-xs text-neutral-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-black file:text-white hover:file:bg-neutral-800 cursor-pointer"
                    />
                    <p className="text-[10px] text-neutral-400 font-medium">JPG, PNG, or WEBP (Max 10MB). Uploaded securely to Cloudinary.</p>
                  </div>
                </div>

                {/* Full Name */}
                <div>
                  <label htmlFor="profileName" className="block mb-1.5 font-bold text-black">
                    Full Name <span className="text-black">*</span>
                  </label>
                  <input
                    id="profileName"
                    name="name"
                    disabled={loading}
                    value={nameVal}
                    onChange={(e) => setNameVal(e.target.value)}
                    onBlur={() => handleBlur("name")}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-black border transition-all ${
                      touched.name && getFieldError("name")
                        ? "border-neutral-900 bg-neutral-50"
                        : "border-neutral-200 focus:border-black"
                    } focus:outline-none disabled:bg-neutral-100 disabled:opacity-70`}
                    placeholder="e.g. John Doe"
                  />
                  {touched.name && getFieldError("name") && (
                    <span className="text-[11px] text-neutral-600 font-bold mt-1 block">
                      {getFieldError("name")}
                    </span>
                  )}
                </div>

                {/* Work Email */}
                <div>
                  <label htmlFor="profileEmail" className="block mb-1.5 font-bold text-black">
                    Work Email <span className="text-black">*</span>
                  </label>
                  <input
                    id="profileEmail"
                    type="email"
                    name="email"
                    disabled={isEditMode || loading}
                    value={emailVal}
                    onChange={(e) => setEmailVal(e.target.value)}
                    onBlur={() => handleBlur("email")}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-black border transition-all ${
                      touched.email && getFieldError("email")
                        ? "border-neutral-900 bg-neutral-50"
                        : "border-neutral-200 focus:border-black"
                    } focus:outline-none disabled:bg-neutral-100 disabled:text-neutral-400 disabled:border-neutral-200`}
                    placeholder="john@company.com"
                  />
                  {touched.email && getFieldError("email") && (
                    <span className="text-[11px] text-neutral-600 font-bold mt-1 block">
                      {getFieldError("email")}
                    </span>
                  )}
                </div>

                {/* System Role */}
                <div>
                  <label htmlFor="profileRole" className="block mb-1.5 font-bold text-black">
                    System Role <span className="text-black">*</span>
                  </label>
                  <select
                    id="profileRole"
                    name="role"
                    disabled={loading}
                    value={roleVal}
                    onChange={(e) => setRoleVal(e.target.value)}
                    className="w-full rounded-xl px-3.5 py-2.5 text-black border border-neutral-200 focus:border-black focus:outline-none cursor-pointer disabled:bg-neutral-100 disabled:opacity-70"
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="TEAM_LEAD">Team Lead</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>

                {/* Phone Number (Role-based) */}
                {showPhone && (
                  <div>
                    <label htmlFor="profilePhone" className="block mb-1.5 font-bold text-black">
                      Phone Number {isEditMode ? null : <span className="text-black">*</span>}
                    </label>
                    <input
                      id="profilePhone"
                      name="phone"
                      disabled={loading}
                      value={phoneVal}
                      onChange={(e) => setPhoneVal(e.target.value)}
                      onBlur={() => handleBlur("phone")}
                      className={`w-full rounded-xl px-3.5 py-2.5 text-black border transition-all ${
                        touched.phone && getFieldError("phone")
                          ? "border-neutral-900 bg-neutral-50"
                          : "border-neutral-200 focus:border-black"
                      } focus:outline-none disabled:bg-neutral-100 disabled:opacity-70`}
                      placeholder="+91 98765 43210"
                    />
                    {touched.phone && getFieldError("phone") && (
                      <span className="text-[11px] text-neutral-600 font-bold mt-1 block">
                        {getFieldError("phone")}
                      </span>
                    )}
                  </div>
                )}

                {/* Department (Role-based) */}
                {showDepartment && (
                  <div>
                    <label htmlFor="profileDepartment" className="block mb-1.5 font-bold text-black">
                      Department {isEditMode ? null : <span className="text-black">*</span>}
                    </label>
                    <select
                      id="profileDepartment"
                      name="department"
                      disabled={loading}
                      value={departmentVal}
                      onChange={(e) => setDepartmentVal(e.target.value)}
                      onBlur={() => handleBlur("department")}
                      className={`w-full rounded-xl px-3.5 py-2.5 text-black border transition-all ${
                        touched.department && getFieldError("department")
                          ? "border-neutral-900 bg-neutral-50"
                          : "border-neutral-200 focus:border-black"
                      } focus:outline-none cursor-pointer disabled:bg-neutral-100 disabled:opacity-70`}
                    >
                      <option value="">Select Department</option>
                      {DEPARTMENTS.map((deptName) => (
                        <option key={deptName} value={deptName}>{deptName}</option>
                      ))}
                    </select>
                    {touched.department && getFieldError("department") && (
                      <span className="text-[11px] text-neutral-600 font-bold mt-1 block">
                        {getFieldError("department")}
                      </span>
                    )}
                  </div>
                )}

                {/* Date of Birth (Role-based) */}
                {showDob && (
                  <div>
                    <label htmlFor="profileDob" className="block mb-1.5 font-bold text-black">
                      Date of Birth {isEditMode ? null : <span className="text-black">*</span>}
                    </label>
                    <input
                      id="profileDob"
                      type="date"
                      name="dob"
                      disabled={loading}
                      value={dobVal}
                      onChange={(e) => setDobVal(e.target.value)}
                      onBlur={() => handleBlur("dob")}
                      className={`w-full rounded-xl px-3.5 py-2.5 text-black border transition-all ${
                        touched.dob && getFieldError("dob")
                          ? "border-neutral-900 bg-neutral-50"
                          : "border-neutral-200 focus:border-black"
                      } focus:outline-none disabled:bg-neutral-100 disabled:opacity-70`}
                    />
                    {touched.dob && getFieldError("dob") && (
                      <span className="text-[11px] text-neutral-600 font-bold mt-1 block">
                        {getFieldError("dob")}
                      </span>
                    )}
                  </div>
                )}

                {/* Join Date (Role-based) */}
                {showJoinDate && (
                  <div>
                    <label htmlFor="profileJoinDate" className="block mb-1.5 font-bold text-black">
                      Join Date
                    </label>
                    <input
                      id="profileJoinDate"
                      type="date"
                      name="joinDate"
                      disabled={loading}
                      value={joinDateVal}
                      onChange={(e) => setJoinDateVal(e.target.value)}
                      className="w-full rounded-xl px-3.5 py-2.5 text-black border border-neutral-200 focus:border-black focus:outline-none disabled:bg-neutral-100 disabled:opacity-70"
                    />
                  </div>
                )}

                {/* Assigned Team (Role-based) */}
                {showTeam && (
                  <div>
                    <label htmlFor="profileTeamId" className="block mb-1.5 font-bold text-black">
                      Assigned Team
                    </label>
                    <select
                      id="profileTeamId"
                      name="teamId"
                      disabled={loading}
                      value={teamIdVal}
                      onChange={(e) => setTeamIdVal(e.target.value)}
                      className="w-full rounded-xl px-3.5 py-2.5 text-black border border-neutral-200 focus:border-black focus:outline-none cursor-pointer disabled:bg-neutral-100 disabled:opacity-70"
                    >
                      <option value="">Select Team</option>
                      {teams.map((team) => (
                        <option key={team._id} value={team._id}>{team.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Tracks Attendance Checkbox */}
                {showTracksAttendance && (
                  <div className="flex items-center gap-2.5 sm:col-span-2 mt-2">
                    <input
                      type="checkbox"
                      id="tracksAttendance"
                      disabled={loading}
                      checked={tracksAttendanceVal}
                      onChange={(e) => setTracksAttendanceVal(e.target.checked)}
                      className="w-4 h-4 rounded border-neutral-300 text-black focus:ring-black/20 cursor-pointer"
                    />
                    <label htmlFor="tracksAttendance" className="font-bold text-xs text-black cursor-pointer select-none">
                      Track attendance for this employee
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Temporary Password Section (Creation mode) */}
            {!isEditMode && (
              <div className="border-t border-neutral-200 pt-5 space-y-4 text-left">
                <div className="flex items-center gap-2 pb-1 border-b border-neutral-200">
                  <LockIcon className="w-4 h-4 text-black" />
                  <h3 className="font-black text-black text-xs uppercase tracking-wider">
                    Temporary Password
                  </h3>
                </div>

                <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 sm:p-5 space-y-4 max-w-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 space-y-1.5">
                      <label className="text-neutral-500 font-bold text-xs block">Generated Password</label>
                      <div className="relative flex items-center">
                        <input
                          type={showPassword ? "text" : "password"}
                          readOnly
                          disabled={loading}
                          value={passwordVal}
                          className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2.5 pr-20 font-mono font-bold text-sm text-black focus:outline-none select-all"
                        />
                        <div className="absolute right-2 flex items-center gap-1">
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => setShowPassword(!showPassword)}
                            className="p-1.5 text-neutral-400 hover:text-black rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
                            title={showPassword ? "Hide Password" : "Show Password"}
                          >
                            {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                          </button>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => {
                              navigator.clipboard.writeText(passwordVal);
                              toast.success("Password copied");
                            }}
                            className="p-1.5 text-neutral-400 hover:text-black rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
                            title="Copy Password"
                          >
                            <CopyIcon size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => setPasswordVal(generateSecurePassword())}
                      className="sm:self-end h-10 px-3.5 bg-white hover:bg-neutral-100 border border-neutral-200 text-black rounded-xl transition-colors flex items-center justify-center gap-2 text-xs font-bold shrink-0 cursor-pointer shadow-xs"
                    >
                      <RefreshCwIcon className="w-3.5 h-3.5 text-black" />
                      <span>Regenerate</span>
                    </button>
                  </div>

                  <div className="bg-neutral-100 border border-neutral-300 text-black rounded-xl p-3 flex items-start gap-2.5 text-xs">
                    <Info className="w-4 h-4 text-black shrink-0 mt-0.5" />
                    <span className="font-semibold leading-relaxed">
                      The employee will be required to change this temporary password during their first login.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ATTENDANCE HISTORY TAB CONTENT */}
        {activeTab === "attendance" && isEditMode && (
          <div className="space-y-4 text-left">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Attendance Logs History</h3>
              <span className="text-xs font-semibold text-neutral-500">Recent 50 Sessions</span>
            </div>

            {loadingAttendance ? (
              <div className="p-8 text-center text-neutral-400 font-medium text-xs">
                <Loader2Icon className="w-5 h-5 animate-spin mx-auto mb-2 text-black" />
                Loading attendance history...
              </div>
            ) : attendanceHistory.length ? (
              <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Work Mode</th>
                      <th className="p-3">Punch In</th>
                      <th className="p-3">Punch Out</th>
                      <th className="p-3">Hours</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-neutral-700">
                    {attendanceHistory.map((item) => (
                      <tr key={item._id} className="hover:bg-neutral-50 transition-colors">
                        <td className="p-3 font-bold text-black">
                          {new Date(item.date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black text-white border border-neutral-900">
                            {item.workMode}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-medium">
                          {item.punchIn?.time ? new Date(item.punchIn.time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </td>
                        <td className="p-3 font-mono font-medium">
                          {item.punchOut?.time ? new Date(item.punchOut.time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </td>
                        <td className="p-3 font-bold text-black">{item.workingHours || 0} hrs</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.attendanceStatus === "PUNCHED_OUT" ? "bg-black text-white border border-neutral-900" :
                            item.attendanceStatus === "PUNCHED_IN" ? "bg-neutral-200 text-neutral-900 border border-neutral-300" : "bg-neutral-100 text-neutral-700 border border-neutral-200"
                          }`}>
                            {item.attendanceStatus || "ABSENT"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center bg-white border border-neutral-200 rounded-xl text-neutral-400 text-xs font-medium">
                No attendance logs recorded yet for this employee.
              </div>
            )}
          </div>
        )}

        {/* LEAVE HISTORY TAB CONTENT */}
        {activeTab === "leave" && isEditMode && (
          <div className="space-y-4 text-left">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Leave Requests & Balances</h3>
              <span className="text-xs font-semibold text-neutral-500">Recent 50 Requests</span>
            </div>

            {loadingLeaves ? (
              <div className="p-8 text-center text-neutral-400 font-medium text-xs">
                <Loader2Icon className="w-5 h-5 animate-spin mx-auto mb-2 text-black" />
                Loading leave records...
              </div>
            ) : leaveHistory.length ? (
              <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3">Leave Type</th>
                      <th className="p-3">Start Date</th>
                      <th className="p-3">End Date</th>
                      <th className="p-3">Days</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-neutral-700">
                    {leaveHistory.map((l) => (
                      <tr key={l._id} className="hover:bg-neutral-50 transition-colors">
                        <td className="p-3 font-bold text-black">{l.leaveType}</td>
                        <td className="p-3 font-medium">{new Date(l.startDate).toLocaleDateString()}</td>
                        <td className="p-3 font-medium">{new Date(l.endDate).toLocaleDateString()}</td>
                        <td className="p-3 font-bold text-black">{l.totalDays}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            l.status === "APPROVED" ? "bg-black text-white border border-neutral-900" :
                            l.status === "PENDING" ? "bg-neutral-100 text-neutral-800 border border-neutral-300" : "bg-neutral-200 text-neutral-900 border border-neutral-300"
                          }`}>
                            {l.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center bg-white border border-neutral-200 rounded-xl text-neutral-400 text-xs font-medium">
                No leave requests submitted yet for this employee.
              </div>
            )}
          </div>
        )}

        {/* SECURITY SETTINGS TAB CONTENT */}
        {activeTab === "security" && isEditMode && (
          <div className="space-y-5 text-left animate-fade-in">
            {/* Header */}
            <div>
              <h3 className="text-xs font-black text-black uppercase tracking-wider">
                Security Credentials Policy
              </h3>
              <p className="text-[11px] text-neutral-500 font-medium mt-0.5">
                Manage employee access tokens, manual password updates, and active device sessions
              </p>
            </div>

            {loadingSecurity ? (
              <div className="p-8 text-center text-neutral-400 font-medium text-xs">
                <Loader2Icon className="w-5 h-5 animate-spin mx-auto mb-2 text-black" />
                Loading security profile...
              </div>
            ) : (
              <div className="space-y-5">
                {/* SECTION 1: Metrics Overview */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-neutral-200 bg-white shadow-3xs">
                    <span className="text-neutral-500 font-bold uppercase tracking-wider text-[10px] block">Token Version</span>
                    <span className="text-black font-black text-base mt-1 block font-mono">
                      v{securityInfo?.tokenVersion || 1}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl border border-neutral-200 bg-white shadow-3xs">
                    <span className="text-neutral-500 font-bold uppercase tracking-wider text-[10px] block">Active Sessions</span>
                    <span className="text-black font-black text-base mt-1 block font-mono">
                      {securityInfo?.activeSessions || 0}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl border border-neutral-200 bg-white shadow-3xs">
                    <span className="text-neutral-500 font-bold uppercase tracking-wider text-[10px] block">Force Reset Status</span>
                    <span className={`inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      securityInfo?.mustChangePassword ? "bg-neutral-100 text-neutral-800 border border-neutral-300" : "bg-black text-white border border-neutral-900"
                    }`}>
                      {securityInfo?.mustChangePassword ? "REQUIRED" : "COMPLETED"}
                    </span>
                  </div>
                </div>

                {/* SECTION 2: Manual Password & Policy Controls */}
                <div className="p-5 border border-neutral-200 rounded-2xl bg-white space-y-4 shadow-3xs">
                  {/* Manual Password Toggle */}
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-neutral-300 text-black focus:ring-black/20 cursor-pointer shrink-0"
                      checked={changePassword} 
                      onChange={(e) => setChangePassword(e.target.checked)} 
                    />
                    <span className="font-bold text-xs text-black select-none">
                      Manually Change Employee Password
                    </span>
                  </label>

                  {/* Expanded Password Fields */}
                  {changePassword && (
                    <div className="pt-2 pl-7 max-w-2xl animate-fade-in space-y-4 text-xs font-medium">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block mb-1.5 font-bold text-black">New Password</label>
                          <div className="relative flex items-center">
                            <input 
                              type={showPassword ? "text" : "password"} 
                              name="password" 
                              required 
                              value={passwordVal}
                              onChange={(e) => setPasswordVal(e.target.value)}
                              className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2.5 pr-10 text-black font-mono focus:outline-none focus:border-black transition-all"
                              placeholder="Enter new password"
                            />
                            <button 
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 text-neutral-400 hover:text-black cursor-pointer p-1 rounded-md"
                              title={showPassword ? "Hide Password" : "Show Password"}
                            >
                              {showPassword ? <EyeOffIcon size={16}/> : <EyeIcon size={16}/>}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block mb-1.5 font-bold text-black">Confirm New Password</label>
                          <div className="relative flex items-center">
                            <input 
                              type={showConfirmPassword ? "text" : "password"} 
                              name="confirmPassword" 
                              required 
                              value={confirmPasswordVal}
                              onChange={(e) => setConfirmPasswordVal(e.target.value)}
                              className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2.5 pr-10 text-black font-mono focus:outline-none focus:border-black transition-all"
                              placeholder="Confirm new password"
                            />
                            <button 
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 text-neutral-400 hover:text-black cursor-pointer p-1 rounded-md"
                              title={showConfirmPassword ? "Hide Password" : "Show Password"}
                            >
                              {showConfirmPassword ? <EyeOffIcon size={16}/> : <EyeIcon size={16}/>}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <hr className="border-neutral-200" />

                  {/* Force Password Change Toggle */}
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      name="forcePasswordChange"
                      className="w-4 h-4 rounded border-neutral-300 text-black focus:ring-black/20 cursor-pointer shrink-0"
                      checked={forceChange} 
                      onChange={(e) => setForceChange(e.target.checked)} 
                    />
                    <span className="font-bold text-xs text-black select-none">
                      Force password change on next login
                    </span>
                  </label>
                </div>

                {/* SECTION 3: Action Buttons Aligned in One Row */}
                <div className="pt-2">
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <button 
                      type="button" 
                      onClick={handleResetPassword}
                      className="w-full sm:w-auto px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-black font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-2xs"
                    >
                      <KeyIcon className="w-4 h-4 text-black shrink-0" />
                      <span>Reset Temporary Password</span>
                    </button>
                    {securityInfo && securityInfo.activeSessions > 0 && (
                      <button 
                        type="button" 
                        onClick={handleLogoutAll}
                        className="w-full sm:w-auto px-4 py-2.5 bg-neutral-900 hover:bg-black border border-neutral-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-2xs"
                      >
                        <LogOutIcon className="w-4 h-4 text-white shrink-0" />
                        <span>Revoke All Active Sessions</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Actions Footer */}
      {showFooter && (
        <div className="border-t border-neutral-200 bg-white px-6 py-4 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            disabled={loading}
            onClick={handleCancelClick}
            className="btn-secondary px-4 py-2.5 font-bold text-xs cursor-pointer transition-all disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading || (!isEditMode && !isFormValid)}
            className="btn-primary px-6 py-2.5 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2Icon className="w-4 h-4 animate-spin text-white" />}
            <span>
              {loading
                ? "Creating Employee..."
                : isEditMode
                ? activeTab === "security" && changePassword
                  ? "Save New Password"
                  : "Save Changes"
                : "Create Employee"}
            </span>
          </button>
        </div>
      )}
    </form>
  );
};

export default EmployeeForm;
