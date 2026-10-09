import api from './client';

export const classroomApi = {
  createMaterial: (formData) =>
    api.post('/classroom/materials', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  getMaterials: (batchId = null, facultyId = null, type = null, subjectId = null) =>
    api.get('/classroom/materials', {
      params: { batch_id: batchId, faculty_id: facultyId, type, subject_id: subjectId },
    }),

  getBatchSubjects: (batchId) =>
    api.get(`/classroom/batches/${batchId}/subjects`),

  deleteMaterial: (id) => api.delete(`/classroom/materials/${id}`),

  downloadMaterialFile: async (id, fileName = 'download') => {
    const res = await api.get(`/classroom/materials/${id}/download`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  submitAssignment: (materialId, formData) =>
    api.post(`/classroom/materials/${materialId}/submit`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  getSubmissions: (materialId) =>
    api.get(`/classroom/materials/${materialId}/submissions`),

  downloadSubmissionFile: async (id, fileName = 'submission') => {
    const res = await api.get(`/classroom/submissions/${id}/download`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  getMySubmissions: () => api.get('/classroom/my-submissions'),
};
