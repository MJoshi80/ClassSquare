import api from './client';

export const leaveApi = {
  applyLeave: (facultyId, date, reason = '') =>
    api.post('/leaves', { faculty_id: facultyId, date, reason }),

  getLeaves: (facultyId = null, status = null) =>
    api.get('/leaves', { params: { faculty_id: facultyId, status } }),

  getLeave: (id) => api.get(`/leaves/${id}`),

  approveLeave: (id) => api.post(`/leaves/${id}/approve`),

  rejectLeave: (id) => api.post(`/leaves/${id}/reject`),

  getRecommendations: (id) => api.get(`/leaves/${id}/recommendations`),

  assignSubstitute: (id, substituteFacultyId) =>
    api.post(`/leaves/${id}/substitute`, { substitute_faculty_id: substituteFacultyId }),

  getFacultySchedule: (facultyId) => api.get(`/faculty/${facultyId}/schedule`),

  getMySchedule: () => api.get('/faculty/me/schedule'),
};
