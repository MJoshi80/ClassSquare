import React, { useState, useEffect } from 'react';
import { classroomApi } from '../api/classroom';
import {
  UploadIcon,
  MegaphoneIcon,
  ClipboardListIcon,
  FolderIcon,
  AlertTriangleIcon,
  CloseIcon,
} from './Icons';
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
  Alert,
  CircularProgress,
  ButtonGroup,
} from '@mui/material';

export default function CreateMaterialModal({
  isOpen,
  onClose,
  batches = [],
  subjects = [],
  onCreated,
}) {
  const [type, setType] = useState('material'); // 'material', 'assignment', 'announcement'
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [batchId, setBatchId] = useState(batches.length > 0 ? batches[0].id : '');
  const [subjectId, setSubjectId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedBatch = batches.find((b) => b.id === Number(batchId));
  const filteredSubjects = subjects.filter((s) => {
    if (!selectedBatch) return true;
    if (s.department_id && selectedBatch.department_id && s.department_id !== selectedBatch.department_id) return false;
    if (s.semester && selectedBatch.semester && s.semester !== selectedBatch.semester) return false;
    return true;
  });

  useEffect(() => {
    if (filteredSubjects.length > 0) {
      if (!filteredSubjects.some((s) => s.id === Number(subjectId))) {
        setSubjectId(filteredSubjects[0].id);
      }
    } else {
      setSubjectId('');
    }
  }, [batchId, subjects]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a title');
      return;
    }
    if (!batchId) {
      setError('Please select a target batch');
      return;
    }
    if (!subjectId) {
      setError('Please select a course subject');
      return;
    }
    if (type === 'assignment' && !dueDate) {
      setError('Please set a submission deadline for this assignment');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('type', type);
      formData.append('batch_id', batchId);
      formData.append('subject_id', subjectId);
      if (dueDate) {
        formData.append('due_date', dueDate);
      }
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      await classroomApi.createMaterial(formData);
      onCreated && onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to publish classroom post.');
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
          boxShadow: '0 24px 48px -12px rgba(16, 42, 107, 0.25)',
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
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', fontSize: '1.05rem' }}>
            Publish Class Material or Assignment
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.78rem', mt: 0.25 }}>
            Share lecture slides, coursework resources, or homework assignments with deadlines.
          </Typography>
        </Box>

        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: 'text.secondary',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.04)', color: 'text.primary' },
          }}
          aria-label="close"
        >
          <CloseIcon className="w-5 h-5" />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {error && (
            <Alert severity="error" sx={{ borderRadius: '12px', fontSize: '0.8rem' }}>
              {error}
            </Alert>
          )}

          {/* Post Type Selector */}
          <Box>
            <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, color: 'text.secondary', display: 'block', mb: 1 }}>
              Post Category
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
              <Button
                type="button"
                variant={type === 'material' ? 'contained' : 'outlined'}
                onClick={() => setType('material')}
                startIcon={<FolderIcon className="w-4 h-4" />}
                sx={{
                  borderRadius: '10px',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  py: 1,
                  bgcolor: type === 'material' ? '#1d61f2' : '#f8fafc',
                  color: type === 'material' ? '#ffffff' : '#475569',
                  borderColor: type === 'material' ? '#1d61f2' : '#e2e8f0',
                  '&:hover': {
                    bgcolor: type === 'material' ? '#1552d6' : '#f1f5f9',
                  },
                }}
              >
                Note / PDF
              </Button>

              <Button
                type="button"
                variant={type === 'assignment' ? 'contained' : 'outlined'}
                onClick={() => setType('assignment')}
                startIcon={<ClipboardListIcon className="w-4 h-4" />}
                sx={{
                  borderRadius: '10px',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  py: 1,
                  bgcolor: type === 'assignment' ? '#7e22ce' : '#f8fafc',
                  color: type === 'assignment' ? '#ffffff' : '#475569',
                  borderColor: type === 'assignment' ? '#7e22ce' : '#e2e8f0',
                  '&:hover': {
                    bgcolor: type === 'assignment' ? '#6b21a8' : '#f1f5f9',
                  },
                }}
              >
                Assignment
              </Button>

              <Button
                type="button"
                variant={type === 'announcement' ? 'contained' : 'outlined'}
                onClick={() => setType('announcement')}
                startIcon={<MegaphoneIcon className="w-4 h-4" />}
                sx={{
                  borderRadius: '10px',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  py: 1,
                  bgcolor: type === 'announcement' ? '#d97706' : '#f8fafc',
                  color: type === 'announcement' ? '#ffffff' : '#475569',
                  borderColor: type === 'announcement' ? '#d97706' : '#e2e8f0',
                  '&:hover': {
                    bgcolor: type === 'announcement' ? '#b45309' : '#f1f5f9',
                  },
                }}
              >
                Notice
              </Button>
            </Box>
          </Box>

          {/* Target Batch & Subject */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <FormControl fullWidth size="small" required>
              <InputLabel id="batch-select-label">Target Cohort / Batch</InputLabel>
              <Select
                labelId="batch-select-label"
                value={batchId}
                label="Target Cohort / Batch"
                onChange={(e) => setBatchId(Number(e.target.value))}
                sx={{ borderRadius: '10px' }}
              >
                {batches.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    Batch {b.name} (Sem {b.semester})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small" required disabled={filteredSubjects.length === 0}>
              <InputLabel id="subject-select-label">Course Subject</InputLabel>
              <Select
                labelId="subject-select-label"
                value={subjectId}
                label="Course Subject"
                onChange={(e) => setSubjectId(Number(e.target.value))}
                sx={{ borderRadius: '10px' }}
              >
                {filteredSubjects.length === 0 ? (
                  <MenuItem value="">No subjects assigned</MenuItem>
                ) : (
                  filteredSubjects.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name} {s.is_lab ? '(Lab)' : ''}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          </Box>

          {filteredSubjects.length === 0 && (
            <Alert
              severity="warning"
              icon={<AlertTriangleIcon className="w-5 h-5 text-amber-500" />}
              sx={{ borderRadius: '12px', fontSize: '0.78rem' }}
            >
              <strong>Teaching Restriction:</strong> You are only authorized to upload coursework for subjects assigned to your teaching profile. You do not teach any courses for Batch {selectedBatch?.name || 'this cohort'}.
            </Alert>
          )}

          {/* Title */}
          <TextField
            label="Title"
            required
            fullWidth
            size="small"
            placeholder={
              type === 'assignment'
                ? 'e.g. Assignment 2: B-Tree Indexing Implementation'
                : type === 'material'
                ? 'e.g. Unit 3: Dynamic Programming Lecture Slides'
                : 'e.g. Midterm Evaluation Schedule Update'
            }
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            InputProps={{ sx: { borderRadius: '10px' } }}
          />

          {/* Description */}
          <TextField
            label="Instructions / Description"
            multiline
            rows={3}
            fullWidth
            size="small"
            placeholder="Add comprehensive instructions, topics covered, reference chapters, or submission guidelines..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            InputProps={{ sx: { borderRadius: '10px' } }}
          />

          {/* Deadline (if assignment) */}
          {type === 'assignment' && (
            <Box sx={{ p: 2, bgcolor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '12px' }}>
              <TextField
                label="Submission Deadline / Due Date & Time"
                type="datetime-local"
                fullWidth
                size="small"
                required={type === 'assignment'}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                InputProps={{ sx: { borderRadius: '10px', bgcolor: '#ffffff' } }}
              />
              <Typography variant="caption" sx={{ color: '#9333ea', display: 'block', mt: 0.75, fontSize: '0.72rem' }}>
                Submissions after this timestamp will be automatically tagged as Late.
              </Typography>
            </Box>
          )}

          {/* File Attachment */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1 }}>
              File Attachment {type === 'announcement' ? '(Optional)' : '(PDF, DOCX, ZIP, Slides)'}
            </Typography>
            <Box
              sx={{
                border: '2px dashed #cbd5e1',
                borderRadius: '12px',
                p: 2.5,
                bgcolor: '#f8fafc',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'border-color 0.2s, background-color 0.2s',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: '#f1f5f9',
                },
              }}
            >
              <input
                type="file"
                id="material-file"
                style={{ display: 'none' }}
                onChange={(e) => setSelectedFile(e.target.files[0] || null)}
              />
              <label htmlFor="material-file" style={{ cursor: 'pointer', display: 'block' }}>
                <UploadIcon className="w-5 h-5 text-primary-600 mx-auto mb-1.5" />
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.82rem' }}>
                  {selectedFile ? selectedFile.name : 'Click to select file or drag & drop'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem', mt: 0.5, display: 'block' }}>
                  {selectedFile
                    ? `${(selectedFile.size / 1024).toFixed(1)} KB selected`
                    : 'PDF, Word, Slides, or code archive up to 50MB'}
                </Typography>
              </label>
            </Box>
          </Box>
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
            color="inherit"
            onClick={onClose}
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.82rem',
              borderColor: '#cbd5e1',
              color: '#475569',
              '&:hover': { bgcolor: '#f1f5f9', borderColor: '#94a3b8' },
            }}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={loading || !subjectId || filteredSubjects.length === 0}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.82rem',
              px: 2.5,
              boxShadow: '0 4px 14px rgba(29, 97, 242, 0.35)',
            }}
          >
            {loading ? 'Publishing...' : 'Publish to Class'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
