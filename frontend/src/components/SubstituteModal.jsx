import React, { useState, useEffect } from 'react';
import { leaveApi } from '../api/leave';
import { AlertTriangleIcon, CloseIcon } from './Icons';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Alert,
  CircularProgress,
  Paper,
  Chip,
  Card,
} from '@mui/material';

export default function SubstituteModal({ isOpen, onClose, leave, onAssigned }) {
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen && leave) {
      setLoading(true);
      setError('');
      setSuccess('');
      leaveApi
        .getRecommendations(leave.id)
        .then((res) => {
          setRecommendations(res.data);
        })
        .catch((err) => {
          setError(err.response?.data?.detail || 'Failed to compute substitute recommendations.');
        })
        .finally(() => setLoading(false));
    } else {
      setRecommendations(null);
    }
  }, [isOpen, leave]);

  if (!isOpen || !leave) return null;

  const handleAssign = async (substituteFacultyId) => {
    setAssigning(true);
    setError('');
    try {
      await leaveApi.assignSubstitute(leave.id, substituteFacultyId);
      setSuccess('Substitute assigned successfully!');
      setTimeout(() => {
        onAssigned && onAssigned();
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to assign substitute.');
    } finally {
      setAssigning(false);
    }
  };

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
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', fontSize: '1.05rem' }}>
            Intelligent Substitute Finder
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.78rem', mt: 0.25 }}>
            AI-driven constraint checks & workload balancing recommendations for {leave.faculty_name} on {leave.date}
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

      <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {error && (
          <Alert severity="error" sx={{ borderRadius: '12px', fontSize: '0.8rem' }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700 }}>
            {success}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {loading ? (
            <Box sx={{ py: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <CircularProgress size={36} thickness={4} />
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
                Evaluating instructor qualifications, availability, and workloads...
              </Typography>
            </Box>
          ) : recommendations && recommendations.affected_slots.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                p: 4,
                bgcolor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                textAlign: 'center',
              }}
            >
              <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                No scheduled classes found for {leave.faculty_name} on this date.
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                No substitution needed.
              </Typography>
            </Paper>
          ) : (
            recommendations?.affected_slots.map((slot) => (
              <Paper
                key={slot.slot_id}
                elevation={0}
                sx={{
                  p: 2.5,
                  bgcolor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, pb: 1.5, borderBottom: '1px solid #e2e8f0' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.92rem' }}>
                      Period {slot.period}: {slot.subject_name}
                    </Typography>
                    {slot.is_lab && (
                      <Chip
                        label="LAB"
                        size="small"
                        sx={{
                          bgcolor: '#f3e8ff',
                          color: '#7e22ce',
                          fontWeight: 800,
                          fontSize: '0.65rem',
                          height: 20,
                        }}
                      />
                    )}
                  </Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Cohort: <strong>{slot.batch_name}</strong> · Room: <strong>{slot.room_name}</strong>
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontWeight: 800,
                      color: 'text.secondary',
                      mb: 1.5,
                      fontSize: '0.7rem',
                    }}
                  >
                    Ranked Eligible Substitute Candidates ({slot.candidates.length})
                  </Typography>

                  {slot.candidates.length === 0 ? (
                    <Alert
                      severity="warning"
                      icon={<AlertTriangleIcon className="w-4 h-4 text-amber-500" />}
                      sx={{ borderRadius: '12px', fontSize: '0.78rem' }}
                    >
                      No eligible substitute found who is qualified, free during Period {slot.period}, and within load limits.
                    </Alert>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {slot.candidates.map((c, idx) => (
                        <Card
                          key={c.faculty_id}
                          variant="outlined"
                          sx={{
                            p: 2,
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 1.5,
                            bgcolor: idx === 0 ? '#f0fdf4' : '#ffffff',
                            borderColor: idx === 0 ? '#86efac' : '#e2e8f0',
                            boxShadow: idx === 0 ? '0 2px 8px rgba(34, 197, 94, 0.1)' : 'none',
                          }}
                        >
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary' }}>
                                {c.faculty_name}
                              </Typography>
                              {idx === 0 && (
                                <Chip
                                  label="Top Recommendation"
                                  size="small"
                                  sx={{
                                    bgcolor: '#bbf7d0',
                                    color: '#166534',
                                    fontWeight: 800,
                                    fontSize: '0.65rem',
                                    height: 20,
                                  }}
                                />
                              )}
                              {c.is_same_department && (
                                <Chip
                                  label="Same Dept"
                                  size="small"
                                  sx={{
                                    bgcolor: '#dbeafe',
                                    color: '#1d4ed8',
                                    fontWeight: 700,
                                    fontSize: '0.65rem',
                                    height: 20,
                                  }}
                                />
                              )}
                            </Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', gap: 1, mt: 0.5 }}>
                              <span>Load: <strong>{c.current_weekly_load}</strong> / {c.max_classes_per_week} weekly classes</span>
                              <span>·</span>
                              <span>Workload Score: <strong>{c.rank_score}</strong> / 100</span>
                            </Typography>
                          </Box>

                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => handleAssign(c.faculty_id)}
                            disabled={assigning}
                            sx={{
                              borderRadius: '8px',
                              textTransform: 'none',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              px: 2,
                              bgcolor: idx === 0 ? '#16a34a' : 'primary.main',
                              '&:hover': {
                                bgcolor: idx === 0 ? '#15803d' : 'primary.dark',
                              },
                            }}
                          >
                            {assigning ? 'Assigning...' : 'Assign Substitute'}
                          </Button>
                        </Card>
                      ))}
                    </Box>
                  )}
                </Box>
              </Paper>
            ))
          )}
        </Box>
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
