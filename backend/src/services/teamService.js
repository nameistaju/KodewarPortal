import { supabase } from '../config/supabase.js';

let inMemoryTeams = [
  { _id: '1', id: '1', name: 'Core Engineering', description: 'Internal product development team', status: 'ACTIVE', stats: { employees: 15 } },
  { _id: '2', id: '2', name: 'Operations & HR', description: 'People operations & administrative management', status: 'ACTIVE', stats: { employees: 10 } }
];

export const getTeams = async () => {
  const { data: employees } = await supabase.from('employees').select('id, department');
  const count = (employees || []).length;

  return {
    items: inMemoryTeams.map((team) => ({
      ...team,
      stats: { employees: count }
    })),
    pagination: {
      page: 1,
      limit: 25,
      total: inMemoryTeams.length,
      totalPages: 1
    }
  };
};

export const createTeam = async (payload) => {
  const newTeam = {
    _id: String(Date.now()),
    id: String(Date.now()),
    name: payload.name,
    description: payload.description || '',
    status: payload.status || 'ACTIVE',
    stats: { employees: 0 }
  };
  inMemoryTeams.push(newTeam);
  return newTeam;
};

export const updateTeam = async (teamId, payload) => {
  const team = inMemoryTeams.find((t) => t.id === String(teamId) || t._id === String(teamId));
  if (!team) return null;
  Object.assign(team, payload);
  return team;
};

export const deleteTeam = async (teamId) => {
  inMemoryTeams = inMemoryTeams.filter((t) => t.id !== String(teamId) && t._id !== String(teamId));
  return true;
};
