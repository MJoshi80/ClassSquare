import React, { useState } from 'react';
import { classroomApi } from '../api/classroom';
import { UploadIcon, CheckCircleIcon, CloseIcon } from './Icons';
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
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';

export default function SubmitAssignmentModal({ isOpen, onClose, material, onSubmitted }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen || !material) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a file to submit your assignment');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (notes.trim()) {
        formData.append('notes', notes.trim());
      }

      await classroomApi.submitAssignment(material.id, formData);
      setSuccess(true);
      setTimeout(() => {
        onSubmitted && onSubmitted();
        onClose();
        setSuccess(false);
        setSelectedFile(null);
        setNotes('');
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit assignment.');
    } finally {
      setLoading(false);
    }
  };

  const isOverdue = material.due_date && new Date() > new Date(material.due_date);

  return (
    <Dialog
      open={Boolean(isOpen)}
      onClose={onClose}
      maxWidth="xs"
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
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Chip
            label="Turn In Coursework"
            size="small"
            sx={{
              bgcolor: '#f3e8ff',
              color: '#7e22ce',
              fontWeight: 800,
              fontSize: '0.68rem',
              height: 22,
              mb: 1,
            }}
          />
          <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', fontSize: '1rem', lineHeight: 1.3 }}>
            {material.title}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.78rem', mt: 0.5 }}>
            Course: <strong>{material.subject_name}</strong>
            {material.due_date && (
              <span style={{ display: 'block', color: isOverdue ? '#e11d48' : '#64748b', fontWeight: isOverdue ? 700 : 500, marginTop: 2 }}>
                Due: {new Date(material.due_date).toLocaleString()} {isOverdue ? '(Past Deadline)' : ''}
              </span>
            )}
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
        <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && (
            <Alert severity="error" sx={{ borderRadius: '12px', fontSize: '0.8rem' }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert
              severity="success"
              icon={<CheckCircleIcon className="w-5 h-5 text-emerald-600" />}
              sx={{ borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700 }}
            >
              Assignment turned in successfully!
            </Alert>
          )}

          {/* File Upload Zone */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1 }}>
              Assignment File (PDF, Code ZIP, Document)
            </Typography>
            <Box
              sx={{
                border: '2px dashed #cbd5e1',
                borderRadius: '14px',
                p: 3,
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
                id="submission-file"
                required
                style={{ display: 'none' }}
                onChange={(e) => setSelectedFile(e.target.files[0] || null)}
              />
              <label htmlFor="submission-file" style={{ cursor: 'pointer', display: 'block' }}>
                <UploadIcon className="w-5 h-5 text-primary-600 mx-auto mb-1.5" />
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.82rem' }}>
                  {selectedFile ? selectedFile.name : 'Select file to upload'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem', mt: 0.5, display: 'block' }}>
                  {selectedFile
                    ? `${(selectedFile.size / 1024).toFixed(1)} KB ready to submit`
                    : 'PDF, DOCX, ZIP, or code archive'}
                </Typography>
              </label>
            </Box>
          </Box>

          {/* Student Notes */}
          <TextField
            label="Private Comments / Notes for Instructor"
            multiline
            rows={2}
            fullWidth
            size="small"
            placeholder="e.g. Completed all parts including extra credit benchmarks..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            InputProps={{ sx: { borderRadius: '10px' } }}
          />
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
            disabled={loading || success}
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
            {loading ? 'Uploading...' : 'Turn In Work'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
