import { useState } from 'react';
import { 
  Pencil, RotateCcw, UserX, Mail, Phone, Calendar, 
  ShieldAlert, ShieldCheck, Clock, MoreVertical, Shield
} from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../api/helpers';
import Avatar from './Avatar';

const EmployeeCard = ({ employee, onDelete, onEdit }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const inactive = employee.status === 'INACTIVE';

  const handleStatus = async () => {
    try {
      await api.post(`/employees/${employee._id}/${inactive ? 'activate' : 'deactivate'}`);
      toast.success(inactive ? 'Employee activated' : 'Employee deactivated');
      setShowDropdown(false);
      onDelete();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const joinDateFormatted = new Date(employee.joinDate).toLocaleDateString([], {
    year: 'numeric', month: 'short', day: 'numeric'
  });
  
  const lastActiveFormatted = new Date(employee.updatedAt).toLocaleDateString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className={`group relative overflow-hidden card p-6 shadow-sm transition-all duration-300 flex flex-col justify-between h-full border hover:-translate-y-0.5 hover:shadow-xl ${
      inactive ? 'border-rose-200 bg-rose-50/30 text-slate-500' : 'border-slate-200/80 hover:border-slate-300 hover:shadow-md'
    }`}>
      {/* Top Header Row with Status and Dropdown Actions */}
      <div className="flex items-start justify-between mb-4">
        {/* Status Badge */}
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
          inactive 
            ? 'bg-rose-50 text-rose-600 border-rose-100' 
            : 'bg-emerald-50 text-emerald-600 border-emerald-100'
        }`}>
          {employee.status}
        </span>

        {/* Dropdown Action Menu */}
        <div className="relative">
          <button 
            onClick={() => setShowDropdown(!showDropdown)}
            className="p-1 rounded-lg hover:bg-slate-100 border border-transparent hover:border-slate-200 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          
          {showDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
              <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 shadow-xl rounded-xl p-1.5 z-20 text-xs font-semibold text-slate-700">
                <button 
                  onClick={() => { onEdit(employee); setShowDropdown(false); }}
                  className="w-full text-left px-3 py-1.8 hover:bg-slate-50 rounded-lg flex items-center gap-2 text-slate-700 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5 text-[#2EA8FF]" />
                  Edit Profile
                </button>
                <button 
                  onClick={handleStatus}
                  className={`w-full text-left px-3 py-1.8 hover:bg-slate-50 rounded-lg flex items-center gap-2 cursor-pointer ${
                    inactive ? 'text-emerald-600 hover:text-emerald-700' : 'text-rose-600 hover:text-rose-700'
                  }`}
                >
                  {inactive ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      Activate
                    </>
                  ) : (
                    <>
                      <UserX className="w-3.5 h-3.5" />
                      Deactivate
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Employee details */}
      <div className="flex flex-col items-center text-center px-1 pb-1">
        {/* Photo Avatar with Status Indicator */}
        <div className="relative mb-5">
          <Avatar
            employee={employee}
            size="h-[72px] w-[72px]"
            className="border border-slate-200 shadow-md rounded-2xl ring-2 ring-slate-100 transition-transform duration-300 group-hover:scale-[1.03]"
            fallbackClassName="text-2xl"
          />
          <span className={`absolute bottom-0 right-0 block h-3.5 w-3.5 rounded-full border-2 border-white shadow-xs ${
            inactive ? 'bg-slate-400' : 'bg-emerald-500'
          }`} />
        </div>

        <h3 className="font-extrabold text-[#111827] text-base leading-tight tracking-tight">{employee.name}</h3>
        <p className="text-[10px] text-[#64748B] font-bold uppercase mt-1 tracking-wider">{employee.department || 'Unassigned'}</p>
        
        {/* Role Badge */}
        <span className={`mt-2.5 inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider ${
          employee.role === 'ADMIN' 
            ? 'bg-blue-50 text-blue-700 border-blue-100' 
            : 'bg-slate-50 text-slate-600 border-slate-200'
        }`}>
          {employee.role}
        </span>
        
        <div className="w-full border-t border-slate-100 mt-4 pt-3.5 space-y-2 text-[11px] text-[#475569] font-medium">
          <div className="flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{employee.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{employee.phone || 'No phone'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Joined {joinDateFormatted}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1 pt-1.5 border-t border-slate-50">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Updated {lastActiveFormatted}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeCard;
