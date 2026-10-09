import api from './client';

export const votingApi = {
  getSlate: (departmentId, semester) =>
    api.get('/timetable/voting/slate', { params: { department_id: departmentId, semester } }),

  castVote: (versionId) =>
    api.post(`/timetable/voting/${versionId}/vote`),

  getOptionPreview: (versionId) =>
    api.get(`/timetable/voting/${versionId}/preview`),
};
