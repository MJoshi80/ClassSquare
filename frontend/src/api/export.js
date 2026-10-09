import api from './client';

const downloadBlob = (response, defaultFilename) => {
  let filename = defaultFilename;
  const disposition = response.headers['content-disposition'];
  if (disposition && disposition.indexOf('filename=') !== -1) {
    const matches = disposition.match(/filename="?([^"]+)"?/);
    if (matches && matches[1]) {
      filename = matches[1];
    }
  }

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const exportApi = {
  downloadTimetableCsv: async (id) => {
    const res = await api.get(`/export/timetable/${id}/csv`, { responseType: 'blob' });
    downloadBlob(res, `timetable_${id}.csv`);
  },

  downloadTimetableExcel: async (id) => {
    const res = await api.get(`/export/timetable/${id}/excel`, { responseType: 'blob' });
    downloadBlob(res, `timetable_${id}.xlsx`);
  },

  downloadTimetableIcal: async (id) => {
    const res = await api.get(`/export/timetable/${id}/ical`, { responseType: 'blob' });
    downloadBlob(res, `timetable_${id}.ics`);
  },

  downloadBatchIcal: async (batchId, batchName = 'cohort') => {
    const res = await api.get(`/export/batch/${batchId}/ical`, { responseType: 'blob' });
    downloadBlob(res, `${batchName}_schedule.ics`);
  },

  downloadFacultyIcal: async (facultyId, facultyName = 'faculty') => {
    const res = await api.get(`/export/faculty/${facultyId}/ical`, { responseType: 'blob' });
    downloadBlob(res, `${facultyName}_schedule.ics`);
  },
};
