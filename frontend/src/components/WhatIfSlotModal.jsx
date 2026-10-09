import React, { useState, useEffect } from 'react';
import { timetableApi } from '../api/timetable';
import { AlertTriangleIcon, CheckCircleIcon, CloseIcon } from './Icons';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  AlertTitle,
  CircularProgress,
  Paper,
  Grid,
} from '@mui/material';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function WhatIfSlotModal({
  isOpen,
  onClose,
  slot,
  versionId,
  rooms = [],
  faculty = [],
  onSaved,
}) {
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState(1);

  const [simulationResult, setSimulationResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (slot) {
      setSelectedRoomId(slot.room_id);
      setSelectedFacultyId(slot.faculty_id);
      setSelectedDay(slot.day);
      setSelectedPeriod(slot.period);
      setSimulationResult(null);
      setSaveError('');
    }
  }, [slot, isOpen]);

  // Trigger live simulation when selections change
  useEffect(() => {
    if (!slot || !isOpen) return;

    // Only simulate if something changed
    const hasChanged =
      Number(selectedRoomId) !== slot.room_id ||
      Number(selectedFacultyId) !== slot.faculty_id ||
      Number(selectedDay) !== slot.day ||
      Number(selectedPeriod) !== slot.period;

    if (!hasChanged) {
      setSimulationResult(null);
      return;
    }

    const timer = setTimeout(async () => {
      setChecking(true);
      try {
        const res = await timetableApi.simulateEdit(versionId, {
          slot_id: slot.id,
          new_room_id: Number(selectedRoomId),
          new_faculty_id: Number(selectedFacultyId),
          new_day: Number(selectedDay),
          new_period: Number(selectedPeriod),
        });
        setSimulationResult(res.data);
      } catch (err) {
        console.error('Simulation check failed', err);
      } finally {
        setChecking(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [selectedRoomId, selectedFacultyId, selectedDay, selectedPeriod, slot, versionId, isOpen]);

  if (!isOpen || !slot) return null;

  const handleSave = async () => {
    if (simulationResult && simulationResult.has_clashes) {
      setSaveError('Cannot save: unresolved clashes detected. Please pick a clash-free combination.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await timetableApi.updateSlot(slot.id, {
        room_id: Number(selectedRoomId),
        faculty_id: Number(selectedFacultyId),
        day: Number(selectedDay),
        period: Number(selectedPeriod),
      });
      onSaved && onSaved();
      onClose();
    } catch (err) {
      setSaveError(err.response?.data?.detail || 'Failed to update slot.');
    } finally {
      setSaving(false);
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
            What-If Sandbox: Manual Override
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.78rem', mt: 0.25 }}>
            Test candidate room or instructor reassignments with instant zero-clash verification.
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
        {/* Current Slot Info Card */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            bgcolor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.primary' }}>
            {slot.subject_name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
            Cohort: <strong>{slot.batch_name}</strong>
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5 }}>
            Current: {DAYS[slot.day]} · Period {slot.period} · {slot.faculty_name} · {slot.room_name}
          </Typography>
        </Paper>

        {saveError && (
          <Alert severity="error" sx={{ borderRadius: '12px', fontSize: '0.8rem' }}>
            {saveError}
          </Alert>
        )}

        {/* Edit Form */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="day-select-label">Day</InputLabel>
              <Select
                labelId="day-select-label"
                value={selectedDay}
                label="Day"
                onChange={(e) => setSelectedDay(Number(e.target.value))}
                sx={{ borderRadius: '10px' }}
              >
                {DAYS.map((name, idx) => (
                  <MenuItem key={idx} value={idx}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel id="period-select-label">Period</InputLabel>
              <Select
                labelId="period-select-label"
                value={selectedPeriod}
                label="Period"
                onChange={(e) => setSelectedPeriod(Number(e.target.value))}
                sx={{ borderRadius: '10px' }}
              >
                {[1, 2, 3, 4, 5, 6].map((p) => (
                  <MenuItem key={p} value={p}>
                    Period {p}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <FormControl fullWidth size="small">
            <InputLabel id="room-select-label">Assign Classroom / Lab</InputLabel>
            <Select
              labelId="room-select-label"
              value={selectedRoomId}
              label="Assign Classroom / Lab"
              onChange={(e) => setSelectedRoomId(Number(e.target.value))}
              sx={{ borderRadius: '10px' }}
            >
              {rooms.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.name} ({r.capacity} seats{r.is_lab ? ' · Lab' : ''})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel id="faculty-select-label">Assign Faculty Instructor</InputLabel>
            <Select
              labelId="faculty-select-label"
              value={selectedFacultyId}
              label="Assign Faculty Instructor"
              onChange={(e) => setSelectedFacultyId(Number(e.target.value))}
              sx={{ borderRadius: '10px' }}
            >
              {faculty.map((f) => (
                <MenuItem key={f.id} value={f.id}>
                  {f.name} ({f.department_name || 'Dept'})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Real-Time Clash Detection Banner */}
        <Box sx={{ pt: 1 }}>
          {checking && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'text.secondary', fontSize: '0.8rem' }}>
              <CircularProgress size={16} />
              <span>Validating hard constraints & clash resistance...</span>
            </Box>
          )}

          {!checking && simulationResult && (
            <Box>
              {simulationResult.has_clashes ? (
                <Alert
                  severity="error"
                  icon={<AlertTriangleIcon className="w-5 h-5 text-rose-500" />}
                  sx={{ borderRadius: '12px', fontSize: '0.8rem' }}
                >
                  <AlertTitle sx={{ fontWeight: 800, fontSize: '0.85rem' }}>Clash Detected! (Cannot Save)</AlertTitle>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                    {simulationResult.clash_messages.map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </Alert>
              ) : (
                <Alert
                  severity="success"
                  icon={<CheckCircleIcon className="w-5 h-5 text-emerald-500" />}
                  sx={{ borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}
                >
                  0 Clashes — Safe to apply this override!
                </Alert>
              )}
            </Box>
          )}

          {!checking && !simulationResult && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic', display: 'block' }}>
              Make changes above to trigger live constraint validation.
            </Typography>
          )}
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
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={saving || (simulationResult && simulationResult.has_clashes)}
          sx={{
            borderRadius: '10px',
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.82rem',
            px: 2.5,
            boxShadow: '0 4px 14px rgba(29, 97, 242, 0.35)',
          }}
        >
          {saving ? 'Saving...' : 'Confirm & Save Override'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
