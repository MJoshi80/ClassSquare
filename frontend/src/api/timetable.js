import api from './client';

export const timetableApi = {
  generate: (departmentId, semester = null, shift = null) =>
    api.post('/timetable/generate', { department_id: departmentId, semester, shift }),

  getVersions: (departmentId = null, semester = null, status = null) =>
    api.get('/timetable/versions', { params: { department_id: departmentId, semester, status } }),

  getTimetable: (id) => api.get(`/timetable/${id}`),

  approve: (id, comment = '') => api.post(`/timetable/${id}/approve`, { comment }),

  reject: (id, comment = '') => api.post(`/timetable/${id}/reject`, { comment }),

  getLogs: (id) => api.get(`/timetable/${id}/logs`),

  simulateEdit: (versionId, payload) => api.post(`/timetable/${versionId}/simulate-edit`, payload),

  updateSlot: (slotId, payload) => api.put(`/timetable/slots/${slotId}`, payload),

  getBatchSchedule: (batchId) => api.get(`/timetable/batch/${batchId}`),
};
