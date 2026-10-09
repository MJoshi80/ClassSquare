import React, { useState, useEffect } from 'react';
import { classroomApi } from '../api/classroom';
import { DownloadCloudIcon, CheckCircleIcon, CloseIcon } from './Icons';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';

export default function SubmissionsModal({ isOpen, onClose, material }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && material) {
      setLoading(true);
      setError('');
      classroomApi
        .getSubmissions(material.id)
        .then((res) => setSubmissions(res.data))
        .catch((err) => setError(err.response?.data?.detail || 'Failed to load submissions.'))
        .finally(() => setLoading(false));
    }
  }, [isOpen, material]);

  if (!isOpen || !material) return null;

  return (
    <Dialog
      open={Boolean(isOpen)}
      onClose={onClose}
      maxWidth="md"
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
            label="Assignment Submissions"
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
          <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', fontSize: '1.05rem' }}>
            {material.title}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.78rem', mt: 0.25 }}>
            Cohort: <strong>Batch {material.batch_name}</strong> · Course: <strong>{material.subject_name}</strong>
            {material.due_date && ` · Deadline: ${new Date(material.due_date).toLocaleString()}`}
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

      <DialogContent sx={{ p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ borderRadius: '12px', fontSize: '0.8rem', mb: 2.5 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ py: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <CircularProgress size={36} thickness={4} />
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
              Loading student submissions...
            </Typography>
          </Box>
        ) : submissions.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary', fontStyle: 'italic', fontSize: '0.85rem' }}>
            No students have turned in their assignments yet for this task.
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>
                Total Turned In: <strong style={{ color: '#0f172a' }}>{submissions.length}</strong>
              </Typography>
            </Box>

            <TableContainer
              component={Paper}
              elevation={0}
              sx={{
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                overflow: 'hidden',
              }}
            >
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.78rem', py: 1.5 }}>Student Name</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.78rem', py: 1.5 }}>Submitted File</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.78rem', py: 1.5 }}>Submission Time</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.78rem', py: 1.5 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.78rem', py: 1.5 }}>Notes</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.78rem', py: 1.5 }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {submissions.map((sub) => (
                    <TableRow key={sub.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.8rem' }}>
                        {sub.student_name}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography
                            component="span"
                            sx={{
                              fontFamily: 'monospace',
                              fontSize: '0.72rem',
                              bgcolor: '#eff6ff',
                              color: '#1d4ed8',
                              px: 1,
                              py: 0.25,
                              borderRadius: '6px',
                              border: '1px solid #bfdbfe',
                            }}
                          >
                            {sub.file_name}
                          </Typography>
                          {sub.file_size && (
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                              ({(sub.file_size / 1024).toFixed(1)} KB)
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        {new Date(sub.submitted_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {sub.status === 'late' ? (
                          <Chip
                            label="LATE"
                            size="small"
                            sx={{
                              bgcolor: '#fffbeb',
                              color: '#b45309',
                              border: '1px solid #fde68a',
                              fontWeight: 800,
                              fontSize: '0.65rem',
                              height: 20,
                            }}
                          />
                        ) : (
                          <Chip
                            icon={<CheckCircleIcon className="w-3 h-3 text-emerald-600" />}
                            label="ON-TIME"
                            size="small"
                            sx={{
                              bgcolor: '#ecfdf5',
                              color: '#065f46',
                              border: '1px solid #a7f3d0',
                              fontWeight: 800,
                              fontSize: '0.65rem',
                              height: 20,
                            }}
                          />
                        )}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sub.notes || <em style={{ color: '#94a3b8' }}>None</em>}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => classroomApi.downloadSubmissionFile(sub.id, sub.file_name)}
                          startIcon={<DownloadCloudIcon className="w-3.5 h-3.5" />}
                          sx={{
                            borderRadius: '8px',
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            py: 0.5,
                            px: 1.5,
                            bgcolor: '#eff6ff',
                            color: '#1d4ed8',
                            borderColor: '#bfdbfe',
                            '&:hover': {
                              bgcolor: '#dbeafe',
                              borderColor: '#93c5fd',
                            },
                          }}
                        >
                          Download
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          p: 2.5,
          bgcolor: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
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
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
