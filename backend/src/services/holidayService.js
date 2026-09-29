import { supabase } from '../config/supabase.js';
import AppError from '../utils/AppError.js';

export const getHolidays = async () => {
  const { data, error } = await supabase
    .from('holidays')
    .select('*')
    .order('holiday_date', { ascending: true });

  if (error) {
    throw new AppError(`Failed to fetch holidays: ${error.message}`, 500);
  }

  return (data || []).map((row) => ({
    _id: String(row.id),
    id: String(row.id),
    name: row.name,
    date: row.holiday_date,
    created_at: row.created_at
  }));
};

export const createHoliday = async (payload) => {
  const { data, error } = await supabase
    .from('holidays')
    .insert({
      name: payload.name,
      holiday_date: String(payload.date || payload.holiday_date).slice(0, 10),
      created_at: new Date().toISOString()
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new AppError(`Failed to create holiday: ${error?.message || 'Database error'}`, 500);
  }

  return {
    _id: String(data.id),
    id: String(data.id),
    name: data.name,
    date: data.holiday_date,
    created_at: data.created_at
  };
};

export const deleteHoliday = async (holidayId) => {
  const { error } = await supabase
    .from('holidays')
    .delete()
    .eq('id', holidayId);

  if (error) {
    throw new AppError(`Failed to delete holiday: ${error.message}`, 500);
  }

  return true;
};
