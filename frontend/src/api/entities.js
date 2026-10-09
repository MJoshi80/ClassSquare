import api from './client';

export const entitiesApi = {
  // Stats
  getStats: () => api.get('/stats/overview'),

  // Departments
  getDepartments: () => api.get('/departments'),
  createDepartment: (data) => api.post('/departments', data),
  updateDepartment: (id, data) => api.put(`/departments/${id}`, data),
  deleteDepartment: (id) => api.delete(`/departments/${id}`),

  // Rooms
  getRooms: (deptId) => api.get('/rooms', { params: deptId ? { department_id: deptId } : {} }),
  createRoom: (data) => api.post('/rooms', data),
  updateRoom: (id, data) => api.put(`/rooms/${id}`, data),
  deleteRoom: (id) => api.delete(`/rooms/${id}`),

  // Faculty
  getFaculty: (deptId) => api.get('/faculty', { params: deptId ? { department_id: deptId } : {} }),
  createFaculty: (data) => api.post('/faculty', data),
  updateFaculty: (id, data) => api.put(`/faculty/${id}`, data),
  deleteFaculty: (id) => api.delete(`/faculty/${id}`),

  // Subjects
  getSubjects: (deptId, sem) => api.get('/subjects', { params: { department_id: deptId, semester: sem } }),
  createSubject: (data) => api.post('/subjects', data),
  updateSubject: (id, data) => api.put(`/subjects/${id}`, data),
  deleteSubject: (id) => api.delete(`/subjects/${id}`),

  // Elective Bands
  getElectiveBands: () => api.get('/subjects/bands/all'),
  createElectiveBand: (data) => api.post('/subjects/bands', data),

  // Batches
  getBatches: (deptId, sem) => api.get('/batches', { params: { department_id: deptId, semester: sem } }),
  createBatch: (data) => api.post('/batches', data),
  updateBatch: (id, data) => api.put(`/batches/${id}`, data),
  deleteBatch: (id) => api.delete(`/batches/${id}`),

  // Bulk Upload
  previewUpload: (entityType, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/upload/preview?entity_type=${entityType}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  commitUpload: (entityType, rows) => api.post('/upload/commit', { entity_type: entityType, rows }),
  getTemplateUrl: (entityType) => `/api/upload/template/${entityType}`,

  // Bulk Clear Category Data
  clearCategoryData: (entityType) => api.delete(`/${entityType}/clear`),
};

