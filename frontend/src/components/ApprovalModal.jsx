import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  TextField,
  Button,
  Box,
  CircularProgress,
  IconButton,
} from '@mui/material';
import { CloseIcon, CheckCircleIcon, AlertTriangleIcon } from './Icons';


export default function ApprovalModal({ isOpen, onClose, onConfirm, action = 'approve', optionRank = 1 }) {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const isApprove = action === 'approve';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onConfirm(comment);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={Boolean(isOpen)}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: '24px',
          p: 1,
        },
      }}
    >
      <DialogTitle sx={{ m: 0, p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {isApprove ? (
            <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertTriangleIcon className="w-5 h-5 text-rose-600" />
          )}
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
            {isApprove ? 'Approve & Publish Timetable' : 'Reject Timetable Version'}
          </Typography>
        </Box>
        <IconButton
          aria-label="close"
          onClick={onClose}
          size="small"
          sx={{ color: '#94a3b8' }}
        >
          <CloseIcon className="w-4 h-4" />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ px: 2.5, py: 1 }}>
          <Typography sx={{ fontSize: '0.875rem', color: '#475569', mb: 2.5, lineHeight: 1.5 }}>
            {isApprove
              ? `You are publishing Option ${optionRank} as the official active institution timetable. This will lock student voting and activate schedule views for all students and faculty.`
              : `Please provide a reason or modification request for rejecting Option ${optionRank}.`}
          </Typography>

          <Box sx={{ mb: 1 }}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', mb: 1 }}>
              Reviewer Notes / Comment {isApprove ? '(Optional)' : '(Required)'}
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              required={!isApprove}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                isApprove
                  ? 'E.g., Approved after verifying lab hours and student voting consensus.'
                  : 'E.g., Please shift OS Lab from Friday afternoon.'
              }
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 2.5, py: 2, gap: 1 }}>
          <Button variant="outlined" onClick={onClose} sx={{ color: '#475569', borderColor: '#cbd5e1' }}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            color={isApprove ? 'success' : 'error'}
            sx={{ px: 3 }}
          >
            {loading ? (
              <CircularProgress size={20} color="inherit" />
            ) : isApprove ? (
              'Approve & Publish'
            ) : (
              'Confirm Rejection'
            )}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
