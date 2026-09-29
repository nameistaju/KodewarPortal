import Team, { TEAM_STATUS } from '../models/Team.js';
import Employee from '../models/Employee.js';
import AppError from '../utils/AppError.js';
import { escapeRegex, paginated } from '../utils/query.js';

const buildTeamStats = async (teamIds) => {
  const employeeCounts = await Employee.aggregate([
    { $match: { teamId: { $in: teamIds } } },
    { $group: { _id: '$teamId', employees: { $sum: 1 } } }
  ]);

  const employeesByTeam = new Map(employeeCounts.map((row) => [String(row._id), row.employees]));

  return new Map(teamIds.map((teamId) => {
    const key = String(teamId);
    return [key, {
      employees: employeesByTeam.get(key) || 0
    }];
  }));
};

export const getTeams = async (query = {}) => {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.search) {
    const expression = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ name: expression }, { description: expression }, { status: expression }];
  }

  const result = await paginated(Team, filter, query, {
    defaultSort: 'name',
    populate: [{ path: 'createdBy', select: 'name email' }]
  });

  const statsByTeam = await buildTeamStats(result.items.map((team) => team._id));
  result.items = result.items.map((team) => ({
    ...team.toObject(),
    stats: statsByTeam.get(String(team._id)) || {
      employees: 0
    }
  }));

  return result;
};

export const createTeam = async (payload, actorId) => {
  const existing = await Team.findOne({ name: payload.name });
  if (existing) throw new AppError('Team with this name already exists', 409);

  return Team.create({
    name: payload.name,
    description: payload.description || '',
    status: payload.status || TEAM_STATUS.ACTIVE,
    createdBy: actorId
  });
};

export const updateTeam = async (teamId, payload, actorId) => {
  if (payload.name) {
    const existing = await Team.findOne({ name: payload.name, _id: { $ne: teamId } });
    if (existing) throw new AppError('Team with this name already exists', 409);
  }

  const team = await Team.findByIdAndUpdate(
    teamId,
    { ...payload, updatedBy: actorId },
    { returnDocument: 'after', runValidators: true }
  );

  if (!team) throw new AppError('Team not found', 404);
  return team;
};

export const deleteTeam = async (teamId) => {
  const assignedEmployees = await Employee.countDocuments({ teamId });
  if (assignedEmployees > 0) {
    throw new AppError('This team still has assigned employees.', 409);
  }

  const team = await Team.findByIdAndDelete(teamId);
  if (!team) throw new AppError('Team not found', 404);

  return team;
};
