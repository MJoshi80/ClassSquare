import React, { useState, useEffect } from 'react';
import TimetableGrid from './TimetableGrid';
import { votingApi } from '../api/voting';
import { CheckCircleIcon, SparkleIcon, CloseIcon } from './Icons';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
} from '@mui/material';

export default function VotingOptionPreviewModal({
  isOpen,
  onClose,
  option,
  onVote,
  isVotingOpen,
  isUserVote,
}) {
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  useEffect(() => {
    if (isOpen && option?.id) {
      setLoading(true);
      votingApi
        .getOptionPreview(option.id)
        .then((res) => setPreviewData(res.data))
        .catch((err) => console.error('Failed to load option preview', err))
        .finally(() => setLoading(false));
    } else {
      setPreviewData(null);
    }
  }, [isOpen, option?.id]);

  if (!isOpen || !option) return null;

  return (
    <Dialog
      open={Boolean(isOpen)}
      onClose={onClose}
      maxWidth="lg"
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              bgcolor: 'primary.50',
              border: '1px solid',
              borderColor: 'primary.200',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'primary.main',
              fontWeight: 800,
              fontSize: '1rem',
            }}
          >
            #{option.option_rank}
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', fontSize: '1.05rem' }}>
                Option {option.option_rank} Schedule Preview
              </Typography>
              {isUserVote && (
                <Chip
                  size="small"
                  icon={<CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600" />}
                  label="Your Choice"
                  sx={{
                    bgcolor: '#ecfdf5',
                    color: '#065f46',
                    border: '1px solid #a7f3d0',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    height: 24,
                  }}
                />
              )}
            </Box>
            {option.optimization_focus && (
              <Typography variant="caption" sx={{ color: '#2563eb', fontWeight: 700, fontSize: '0.75rem', display: 'block', mt: 0.25 }}>
                {option.optimization_focus}
              </Typography>
            )}
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.78rem', mt: 0.25 }}>
              Student Votes: <strong>{option.vote_count} votes ({option.vote_percentage}%)</strong>
            </Typography>
          </Box>
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

      <DialogContent sx={{ p: 3, bgcolor: '#ffffff', minHeight: 320 }}>
        {loading ? (
          <Box sx={{ py: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <CircularProgress size={36} thickness={4} />
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              Loading candidate timetable matrix...
            </Typography>
          </Box>
        ) : previewData ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Alert
              severity="info"
              icon={<SparkleIcon className="w-5 h-5 text-blue-600" />}
              sx={{
                bgcolor: '#eff6ff',
                color: '#1e40af',
                border: '1px solid #bfdbfe',
                borderRadius: '12px',
                fontSize: '0.8rem',
                '& .MuiAlert-message': {
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  flexWrap: 'wrap',
                  gap: 1,
                },
              }}
            >
              <span>
                <strong>{option.optimization_focus || 'Candidate Highlights'}:</strong> {option.slot_count} teaching periods, {option.free_periods_count} free study gaps.
              </span>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  label={`${Math.round(option.score)}% Optimized`}
                  size="small"
                  sx={{
                    bgcolor: '#dbeafe',
                    color: '#1d4ed8',
                    fontWeight: 800,
                    fontSize: '0.7rem',
                    height: 22,
                  }}
                />
                <Chip
                  label="0 Clashes"
                  size="small"
                  sx={{
                    bgcolor: '#ecfdf5',
                    color: '#065f46',
                    border: '1px solid #a7f3d0',
                    fontWeight: 800,
                    fontSize: '0.7rem',
                    height: 22,
                  }}
                />
              </Box>
            </Alert>

            {option.top_optimized_constraints && option.top_optimized_constraints.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, p: 1.5, bgcolor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#334155', fontSize: '0.72rem', width: '100%' }}>
                  Primary Constraint Strengths:
                </Typography>
                {option.top_optimized_constraints.map((c, i) => (
                  <Chip
                    key={i}
                    label={`${c.name}: ${c.badge || c.metric}`}
                    size="small"
                    sx={{
                      bgcolor: '#ffffff',
                      color: '#0f172a',
                      border: '1px solid #cbd5e1',
                      fontWeight: 700,
                      fontSize: '0.68rem',
                      height: 24,
                    }}
                  />
                ))}
              </Box>
            )}

            <TimetableGrid slots={previewData.slots || []} readonly={true} />
          </Box>
        ) : (
          <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary', fontStyle: 'italic', fontSize: '0.85rem' }}>
            Unable to load schedule preview.
          </Box>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          p: 2.5,
          bgcolor: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          justifyContent: 'space-between',
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
          Close Preview
        </Button>

        {isVotingOpen ? (
          isUserVote ? (
            <Chip
              icon={<CheckCircleIcon className="w-4 h-4 text-emerald-600" />}
              label={`You Voted for Option ${option.option_rank}`}
              sx={{
                bgcolor: '#ecfdf5',
                color: '#065f46',
                border: '1px solid #a7f3d0',
                fontWeight: 700,
                fontSize: '0.82rem',
                py: 2,
                px: 1,
              }}
            />
          ) : (
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                onVote(option.id);
                onClose();
              }}
              sx={{
                borderRadius: '10px',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.82rem',
                px: 3,
                boxShadow: '0 4px 14px rgba(29, 97, 242, 0.35)',
              }}
            >
              Vote for Option {option.option_rank}
            </Button>
          )
        ) : (
          <Chip
            label="Voting Closed (Official Schedule Approved)"
            size="medium"
            sx={{
              bgcolor: '#e2e8f0',
              color: '#475569',
              fontWeight: 700,
              fontSize: '0.78rem',
            }}
          />
        )}
      </DialogActions>
    </Dialog>
  );
}
