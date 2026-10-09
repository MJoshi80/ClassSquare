import React, { useState, useEffect } from 'react';
import { CloseIcon } from './Icons';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Alert,
  CircularProgress,
  Paper,
} from '@mui/material';

const ENTITY_LABELS = {
  departments: 'Department',
  rooms: 'Room / Lab',
  faculty: 'Faculty',
  subjects: 'Subject',
  batches: 'Batch',
};

export default function EntityModal({
  isOpen,
  onClose,
  onSave,
  entityType,
  initialData = null,
  extraOptions = {},
}) {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      if (entityType === 'departments') setFormData({ name: '', shift: 'morning' });
      else if (entityType === 'rooms') setFormData({ name: '', capacity: 60, is_lab: false, department_id: '' });
      else if (entityType === 'faculty') setFormData({ name: '', department_id: '', max_classes_per_day: 4, max_classes_per_week: 18, avg_monthly_leaves: 2.0, subject_ids: [] });
      else if (entityType === 'subjects') setFormData({ name: '', department_id: '', semester: 3, sessions_per_week: 3, is_lab: false, is_elective: false, elective_band_id: '' });
      else if (entityType === 'batches') setFormData({ name: '', department_id: '', semester: 3, shift: 'morning', strength: 60 });
    }
    setError('');
  }, [isOpen, initialData, entityType]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = { ...formData };
      if ('department_id' in payload) payload.department_id = payload.department_id ? Number(payload.department_id) : null;
      if ('elective_band_id' in payload) payload.elective_band_id = payload.elective_band_id ? Number(payload.elective_band_id) : null;
      if ('capacity' in payload) payload.capacity = Number(payload.capacity);
      if ('semester' in payload) payload.semester = Number(payload.semester);
      if ('sessions_per_week' in payload) payload.sessions_per_week = Number(payload.sessions_per_week);
      if ('strength' in payload) payload.strength = Number(payload.strength);
      if ('max_classes_per_day' in payload) payload.max_classes_per_day = Number(payload.max_classes_per_day);
      if ('max_classes_per_week' in payload) payload.max_classes_per_week = Number(payload.max_classes_per_week);
      if ('avg_monthly_leaves' in payload) payload.avg_monthly_leaves = Number(payload.avg_monthly_leaves);

      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save entity.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={Boolean(isOpen)}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 20px 40px -8px rgba(16, 42, 107, 0.15)',
          bgcolor: '#ffffff',
          border: '1px solid #e2e8f0',
        },
      }}
    >
      <DialogTitle
        sx={{
          p: 2.5,
          bgcolor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', fontSize: '1.05rem' }}>
          {initialData ? 'Edit' : 'Add'} {ENTITY_LABELS[entityType] || entityType}
        </Typography>

        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: 'text.secondary',
            '&:hover': { bgcolor: '#f1f5f9', color: 'text.primary' },
          }}
          aria-label="close"
        >
          <CloseIcon className="w-5 h-5" />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, bgcolor: '#ffffff' }}>
          {error && (
            <Alert severity="error" sx={{ borderRadius: '12px', fontSize: '0.8rem' }}>
              {error}
            </Alert>
          )}

          {/* Common Name field */}
          <TextField
            label="Name / Label"
            required
            fullWidth
            size="small"
            value={formData.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            InputProps={{ sx: { borderRadius: '10px' } }}
          />

          {/* Department FK for Rooms, Faculty, Subjects, Batches */}
          {['rooms', 'faculty', 'subjects', 'batches'].includes(entityType) && (
            <FormControl fullWidth size="small">
              <InputLabel id="dept-select-label">Department</InputLabel>
              <Select
                labelId="dept-select-label"
                value={formData.department_id || ''}
                label="Department"
                onChange={(e) => handleChange('department_id', e.target.value)}
                sx={{ borderRadius: '10px' }}
              >
                <MenuItem value="">
                  <em>-- None / Shared Campus --</em>
                </MenuItem>
                {extraOptions.departments?.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Department specific fields */}
          {entityType === 'departments' && (
            <FormControl fullWidth size="small">
              <InputLabel id="shift-select-label">Shift</InputLabel>
              <Select
                labelId="shift-select-label"
                value={formData.shift || 'morning'}
                label="Shift"
                onChange={(e) => handleChange('shift', e.target.value)}
                sx={{ borderRadius: '10px' }}
              >
                <MenuItem value="morning">Morning</MenuItem>
                <MenuItem value="evening">Evening</MenuItem>
              </Select>
            </FormControl>
          )}

          {/* Room specific fields */}
          {entityType === 'rooms' && (
            <>
              <TextField
                label="Capacity (Seats)"
                type="number"
                required
                fullWidth
                size="small"
                inputProps={{ min: 1 }}
                value={formData.capacity || 60}
                onChange={(e) => handleChange('capacity', e.target.value)}
                InputProps={{ sx: { borderRadius: '10px' } }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.is_lab || false}
                    onChange={(e) => handleChange('is_lab', e.target.checked)}
                    color="primary"
                  />
                }
                label="Is Practical / Computer Laboratory"
                sx={{ '& .MuiTypography-root': { fontSize: '0.85rem', fontWeight: 600 } }}
              />
            </>
          )}

          {/* Faculty specific fields */}
          {entityType === 'faculty' && (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <TextField
                  label="Max Classes/Day"
                  type="number"
                  fullWidth
                  size="small"
                  inputProps={{ min: 1, max: 8 }}
                  value={formData.max_classes_per_day || 4}
                  onChange={(e) => handleChange('max_classes_per_day', e.target.value)}
                  InputProps={{ sx: { borderRadius: '10px' } }}
                />
                <TextField
                  label="Max Classes/Week"
                  type="number"
                  fullWidth
                  size="small"
                  inputProps={{ min: 1, max: 40 }}
                  value={formData.max_classes_per_week || 18}
                  onChange={(e) => handleChange('max_classes_per_week', e.target.value)}
                  InputProps={{ sx: { borderRadius: '10px' } }}
                />
              </Box>

              <TextField
                label="Avg Monthly Leaves"
                type="number"
                fullWidth
                size="small"
                inputProps={{ step: 0.5, min: 0 }}
                value={formData.avg_monthly_leaves || 2.0}
                onChange={(e) => handleChange('avg_monthly_leaves', e.target.value)}
                InputProps={{ sx: { borderRadius: '10px' } }}
              />

              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1 }}>
                  Qualified Subjects
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    maxHeight: 140,
                    overflowY: 'auto',
                    p: 1.5,
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5,
                    bgcolor: '#f8fafc',
                    borderColor: '#e2e8f0',
                  }}
                >
                  {extraOptions.subjects?.map((s) => (
                    <FormControlLabel
                      key={s.id}
                      control={
                        <Checkbox
                          size="small"
                          checked={formData.subject_ids?.includes(s.id) || false}
                          onChange={(e) => {
                            const current = formData.subject_ids || [];
                            if (e.target.checked) handleChange('subject_ids', [...current, s.id]);
                            else handleChange('subject_ids', current.filter((id) => id !== s.id));
                          }}
                          color="primary"
                        />
                      }
                      label={`${s.name} (Sem ${s.semester})`}
                      sx={{ '& .MuiTypography-root': { fontSize: '0.78rem', fontWeight: 500 } }}
                    />
                  ))}
                </Paper>
              </Box>
            </>
          )}

          {/* Subject specific fields */}
          {entityType === 'subjects' && (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <TextField
                  label="Semester"
                  type="number"
                  fullWidth
                  size="small"
                  inputProps={{ min: 1, max: 8 }}
                  value={formData.semester || 3}
                  onChange={(e) => handleChange('semester', e.target.value)}
                  InputProps={{ sx: { borderRadius: '10px' } }}
                />
                <TextField
                  label="Classes / Week"
                  type="number"
                  fullWidth
                  size="small"
                  inputProps={{ min: 1, max: 10 }}
                  value={formData.sessions_per_week || 3}
                  onChange={(e) => handleChange('sessions_per_week', e.target.value)}
                  InputProps={{ sx: { borderRadius: '10px' } }}
                />
              </Box>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.is_lab || false}
                      onChange={(e) => handleChange('is_lab', e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Requires Lab"
                  sx={{ '& .MuiTypography-root': { fontSize: '0.82rem', fontWeight: 600 } }}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.is_elective || false}
                      onChange={(e) => handleChange('is_elective', e.target.checked)}
                      color="primary"
                    />
                  }
                  label="NEP 2020 Elective"
                  sx={{ '& .MuiTypography-root': { fontSize: '0.82rem', fontWeight: 600 } }}
                />
              </Box>

              {formData.is_elective && (
                <FormControl fullWidth size="small">
                  <InputLabel id="elective-band-select-label">Elective Band</InputLabel>
                  <Select
                    labelId="elective-band-select-label"
                    value={formData.elective_band_id || ''}
                    label="Elective Band"
                    onChange={(e) => handleChange('elective_band_id', e.target.value)}
                    sx={{ borderRadius: '10px' }}
                  >
                    <MenuItem value="">
                      <em>-- Select Elective Slot --</em>
                    </MenuItem>
                    {extraOptions.electiveBands?.map((b) => (
                      <MenuItem key={b.id} value={b.id}>
                        {b.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </>
          )}

          {/* Batch specific fields */}
          {entityType === 'batches' && (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <TextField
                  label="Semester"
                  type="number"
                  fullWidth
                  size="small"
                  inputProps={{ min: 1, max: 8 }}
                  value={formData.semester || 3}
                  onChange={(e) => handleChange('semester', e.target.value)}
                  InputProps={{ sx: { borderRadius: '10px' } }}
                />
                <TextField
                  label="Cohort Strength"
                  type="number"
                  fullWidth
                  size="small"
                  inputProps={{ min: 1 }}
                  value={formData.strength || 60}
                  onChange={(e) => handleChange('strength', e.target.value)}
                  InputProps={{ sx: { borderRadius: '10px' } }}
                />
              </Box>

              <FormControl fullWidth size="small">
                <InputLabel id="batch-shift-select-label">Shift</InputLabel>
                <Select
                  labelId="batch-shift-select-label"
                  value={formData.shift || 'morning'}
                  label="Shift"
                  onChange={(e) => handleChange('shift', e.target.value)}
                  sx={{ borderRadius: '10px' }}
                >
                  <MenuItem value="morning">Morning</MenuItem>
                  <MenuItem value="evening">Evening</MenuItem>
                </Select>
              </FormControl>
            </>
          )}
        </DialogContent>

        <DialogActions
          sx={{
            p: 2.5,
            bgcolor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            justifyContent: 'flex-end',
            gap: 1.5,
          }}
        >
          <Button
            variant="outlined"
            onClick={onClose}
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.82rem',
              borderColor: '#cbd5e1',
              color: 'text.secondary',
              '&:hover': { bgcolor: '#f1f5f9', borderColor: '#94a3b8' },
            }}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.82rem',
              px: 2.5,
              bgcolor: '#1d61f2',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(29, 97, 242, 0.25)',
              '&:hover': { bgcolor: '#1548b8' },
            }}
          >
            {loading ? 'Saving...' : 'Save Record'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

