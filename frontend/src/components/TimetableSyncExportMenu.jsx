import React, { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  MoreVerticalIcon,
  CalendarIcon,
  SpreadsheetIcon,
  FileTextIcon,
  PrinterIcon,
  SparkleIcon,
  CloseIcon,
  CheckIcon,
} from './Icons';

export default function TimetableSyncExportMenu({
  scheduleTitle = 'Weekly Schedule Matrix',
  onSyncIcal,
  onExportExcel,
  onExportCsv,
  onPrint = () => window.print(),
  disabled = false,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  const isMenuOpen = Boolean(anchorEl);

  const handleOpenMenu = (e) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleOpenDialog = () => {
    handleCloseMenu();
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setActionSuccess('');
  };

  const triggerAction = async (actionFn, successMsg) => {
    if (!actionFn) return;
    try {
      await actionFn();
      if (successMsg) {
        setActionSuccess(successMsg);
        setTimeout(() => setActionSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Export action failed', err);
    }
  };

  return (
    <>
      <Tooltip title="Sync & Export Schedule" arrow>
        <span>
          <IconButton
            size="small"
            onClick={handleOpenMenu}
            disabled={disabled}
            aria-label="sync and export options"
            aria-controls={isMenuOpen ? 'timetable-sync-export-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={isMenuOpen ? 'true' : undefined}
            sx={{
              width: 34,
              height: 34,
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              bgcolor: isMenuOpen ? '#eff6ff' : '#ffffff',
              color: isMenuOpen ? '#1d61f2' : '#475569',
              transition: 'all 0.15s ease',
              '&:hover': {
                bgcolor: '#f1f5f9',
                borderColor: '#94a3b8',
                color: '#0f172a',
              },
            }}
          >
            <MoreVerticalIcon className="w-4 h-4" />
          </IconButton>
        </span>
      </Tooltip>

      {/* Dropdown Menu */}
      <Menu
        id="timetable-sync-export-menu"
        anchorEl={anchorEl}
        open={isMenuOpen}
        onClose={handleCloseMenu}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          elevation: 4,
          sx: {
            mt: 1,
            minWidth: 260,
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)',
            p: 0.5,
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.2 }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#94a3b8',
              fontSize: '0.66rem',
              display: 'block',
            }}
          >
            Timetable Options
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.82rem' }}>
            Sync & Export Actions
          </Typography>
        </Box>

        <Divider sx={{ my: 0.5, borderColor: '#f1f5f9' }} />

        {/* Sync with Calendar */}
        {onSyncIcal && (
          <MenuItem
            onClick={() => {
              handleCloseMenu();
              triggerAction(onSyncIcal);
            }}
            sx={{
              borderRadius: '10px',
              py: 1,
              px: 1.5,
              '&:hover': { bgcolor: '#f0fdf4' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Box
                sx={{
                  width: 26,
                  height: 26,
                  borderRadius: '7px',
                  bgcolor: '#e0e7ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CalendarIcon className="w-3.5 h-3.5 text-indigo-600" />
              </Box>
            </ListItemIcon>
            <ListItemText
              primary="Sync Calendar (.ics)"
              secondary="Google Calendar, Apple, Outlook"
              primaryTypographyProps={{ fontWeight: 700, fontSize: '0.8rem', color: '#1e293b' }}
              secondaryTypographyProps={{ fontSize: '0.68rem', color: '#64748b' }}
            />
          </MenuItem>
        )}

        {/* Export Excel */}
        {onExportExcel && (
          <MenuItem
            onClick={() => {
              handleCloseMenu();
              triggerAction(onExportExcel);
            }}
            sx={{
              borderRadius: '10px',
              py: 1,
              px: 1.5,
              '&:hover': { bgcolor: '#f0fdf4' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Box
                sx={{
                  width: 26,
                  height: 26,
                  borderRadius: '7px',
                  bgcolor: '#dcfce7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <SpreadsheetIcon className="w-3.5 h-3.5 text-emerald-600" />
              </Box>
            </ListItemIcon>
            <ListItemText
              primary="Export to Excel (.xlsx)"
              secondary="Formatted schedule matrix"
              primaryTypographyProps={{ fontWeight: 700, fontSize: '0.8rem', color: '#1e293b' }}
              secondaryTypographyProps={{ fontSize: '0.68rem', color: '#64748b' }}
            />
          </MenuItem>
        )}

        {/* Export CSV */}
        {onExportCsv && (
          <MenuItem
            onClick={() => {
              handleCloseMenu();
              triggerAction(onExportCsv);
            }}
            sx={{
              borderRadius: '10px',
              py: 1,
              px: 1.5,
              '&:hover': { bgcolor: '#eff6ff' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Box
                sx={{
                  width: 26,
                  height: 26,
                  borderRadius: '7px',
                  bgcolor: '#dbeafe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FileTextIcon className="w-3.5 h-3.5 text-blue-600" />
              </Box>
            </ListItemIcon>
            <ListItemText
              primary="Export to CSV (.csv)"
              secondary="Raw dataset for pipelines"
              primaryTypographyProps={{ fontWeight: 700, fontSize: '0.8rem', color: '#1e293b' }}
              secondaryTypographyProps={{ fontSize: '0.68rem', color: '#64748b' }}
            />
          </MenuItem>
        )}

        {/* Print Schedule */}
        {onPrint && (
          <MenuItem
            onClick={() => {
              handleCloseMenu();
              triggerAction(onPrint);
            }}
            sx={{
              borderRadius: '10px',
              py: 1,
              px: 1.5,
              '&:hover': { bgcolor: '#f8fafc' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Box
                sx={{
                  width: 26,
                  height: 26,
                  borderRadius: '7px',
                  bgcolor: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PrinterIcon className="w-3.5 h-3.5 text-slate-600" />
              </Box>
            </ListItemIcon>
            <ListItemText
              primary="Print Matrix / PDF"
              secondary="A4 print & vector export"
              primaryTypographyProps={{ fontWeight: 700, fontSize: '0.8rem', color: '#1e293b' }}
              secondaryTypographyProps={{ fontSize: '0.68rem', color: '#64748b' }}
            />
          </MenuItem>
        )}

        <Divider sx={{ my: 0.5, borderColor: '#f1f5f9' }} />

        {/* Detailed Modal Trigger */}
        <MenuItem
          onClick={handleOpenDialog}
          sx={{
            borderRadius: '10px',
            py: 1,
            px: 1.5,
            bgcolor: '#f8fafc',
            '&:hover': { bgcolor: '#f1f5f9' },
          }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <Box
              sx={{
                width: 26,
                height: 26,
                borderRadius: '7px',
                bgcolor: '#eff6ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SparkleIcon className="w-3.5 h-3.5 text-primary-600" />
            </Box>
          </ListItemIcon>
          <ListItemText
            primary="Sync & Export Dialog..."
            secondary="Format overview & guides"
            primaryTypographyProps={{ fontWeight: 800, fontSize: '0.78rem', color: 'primary.main' }}
            secondaryTypographyProps={{ fontSize: '0.66rem', color: '#64748b' }}
          />
        </MenuItem>
      </Menu>

      {/* Sync & Export Options Modal Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          elevation: 6,
          sx: {
            borderRadius: '24px',
            p: 1,
            border: '1px solid #e2e8f0',
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900, color: '#0f2851', letterSpacing: '-0.02em', fontSize: '1.2rem' }}>
              Sync & Export Timetable
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.82rem', mt: 0.25 }}>
              {scheduleTitle}
            </Typography>
          </Box>
          <IconButton onClick={handleCloseDialog} size="small" sx={{ borderRadius: '10px' }}>
            <CloseIcon className="w-4 h-4" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ borderColor: '#f1f5f9', py: 2.5 }}>
          {actionSuccess && (
            <Box
              sx={{
                mb: 2,
                p: 1.5,
                borderRadius: '12px',
                bgcolor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                color: '#065f46',
                fontSize: '0.82rem',
                fontWeight: 700,
              }}
            >
              <CheckIcon className="w-4 h-4 text-emerald-600" />
              <span>{actionSuccess}</span>
            </Box>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* 1. Calendar Sync (.ics) */}
            {onSyncIcal && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  bgcolor: '#ffffff',
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  justifyContent: 'space-between',
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: 1.5,
                  transition: 'border-color 0.2s',
                  '&:hover': { borderColor: '#c7d2fe', bgcolor: '#fdfefe' },
                }}
              >
                <Box sx={{ display: 'flex', gap: 1.75, alignItems: 'flex-start' }}>
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: '12px',
                      bgcolor: '#e0e7ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <CalendarIcon className="w-5 h-5 text-indigo-600" />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.88rem' }}>
                        Calendar Synchronization
                      </Typography>
                      <Chip label=".ics / iCal" size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800, bgcolor: '#eef2ff', color: '#4338ca' }} />
                    </Box>
                    <Typography sx={{ color: '#64748b', fontSize: '0.76rem', mt: 0.5, lineHeight: 1.35 }}>
                      Compatible with Google Calendar, Microsoft Outlook, and Apple Calendar with automatic lecture period times and room reminders.
                    </Typography>
                  </Box>
                </Box>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => triggerAction(onSyncIcal, 'iCal schedule file (.ics) downloaded successfully!')}
                  sx={{
                    borderRadius: '10px',
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.76rem',
                    bgcolor: '#4f46e5',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)',
                    '&:hover': { bgcolor: '#4338ca' },
                  }}
                >
                  Download .ics
                </Button>
              </Box>
            )}

            {/* 2. Excel Spreadsheet */}
            {onExportExcel && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  bgcolor: '#ffffff',
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  justifyContent: 'space-between',
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: 1.5,
                  transition: 'border-color 0.2s',
                  '&:hover': { borderColor: '#bbf7d0', bgcolor: '#fdfefe' },
                }}
              >
                <Box sx={{ display: 'flex', gap: 1.75, alignItems: 'flex-start' }}>
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: '12px',
                      bgcolor: '#dcfce7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <SpreadsheetIcon className="w-5 h-5 text-emerald-600" />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.88rem' }}>
                        Microsoft Excel Workbook
                      </Typography>
                      <Chip label=".xlsx" size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800, bgcolor: '#ecfdf5', color: '#065f46' }} />
                    </Box>
                    <Typography sx={{ color: '#64748b', fontSize: '0.76rem', mt: 0.5, lineHeight: 1.35 }}>
                      Complete 5-day matrix grid formatted with course codes, assigned faculty, room locations, and break periods.
                    </Typography>
                  </Box>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => triggerAction(onExportExcel, 'Excel workbook (.xlsx) exported successfully!')}
                  sx={{
                    borderRadius: '10px',
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.76rem',
                    borderColor: '#86efac',
                    color: '#15803d',
                    flexShrink: 0,
                    '&:hover': { borderColor: '#22c55e', bgcolor: '#f0fdf4' },
                  }}
                >
                  Export .xlsx
                </Button>
              </Box>
            )}

            {/* 3. CSV Dataset */}
            {onExportCsv && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  bgcolor: '#ffffff',
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  justifyContent: 'space-between',
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: 1.5,
                  transition: 'border-color 0.2s',
                  '&:hover': { borderColor: '#bfdbfe', bgcolor: '#fdfefe' },
                }}
              >
                <Box sx={{ display: 'flex', gap: 1.75, alignItems: 'flex-start' }}>
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: '12px',
                      bgcolor: '#dbeafe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <FileTextIcon className="w-5 h-5 text-blue-600" />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.88rem' }}>
                        Comma-Separated Dataset
                      </Typography>
                      <Chip label=".csv" size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800, bgcolor: '#eff6ff', color: '#1d4ed8' }} />
                    </Box>
                    <Typography sx={{ color: '#64748b', fontSize: '0.76rem', mt: 0.5, lineHeight: 1.35 }}>
                      Structured tabular data for downstream institutional reporting, administrative scripts, or data warehouse pipelines.
                    </Typography>
                  </Box>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => triggerAction(onExportCsv, 'CSV dataset (.csv) exported successfully!')}
                  sx={{
                    borderRadius: '10px',
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.76rem',
                    borderColor: '#93c5fd',
                    color: '#1d4ed8',
                    flexShrink: 0,
                    '&:hover': { borderColor: '#3b82f6', bgcolor: '#eff6ff' },
                  }}
                >
                  Export .csv
                </Button>
              </Box>
            )}

            {/* 4. Print / PDF */}
            {onPrint && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  bgcolor: '#ffffff',
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  justifyContent: 'space-between',
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: 1.5,
                  transition: 'border-color 0.2s',
                  '&:hover': { borderColor: '#cbd5e1', bgcolor: '#fdfefe' },
                }}
              >
                <Box sx={{ display: 'flex', gap: 1.75, alignItems: 'flex-start' }}>
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: '12px',
                      bgcolor: '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <PrinterIcon className="w-5 h-5 text-slate-600" />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.88rem' }}>
                        Print / Save as PDF
                      </Typography>
                      <Chip label="Vector A4" size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800, bgcolor: '#f1f5f9', color: '#475569' }} />
                    </Box>
                    <Typography sx={{ color: '#64748b', fontSize: '0.76rem', mt: 0.5, lineHeight: 1.35 }}>
                      Formats the schedule matrix into an optimized, margins-free vector document ready for physical printing or saving as PDF.
                    </Typography>
                  </Box>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    handleCloseDialog();
                    setTimeout(onPrint, 300);
                  }}
                  sx={{
                    borderRadius: '10px',
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.76rem',
                    borderColor: '#cbd5e1',
                    color: '#334155',
                    flexShrink: 0,
                    '&:hover': { borderColor: '#94a3b8', bgcolor: '#f8fafc' },
                  }}
                >
                  Print Matrix
                </Button>
              </Box>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 2.5, py: 1.5 }}>
          <Button
            onClick={handleCloseDialog}
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.82rem',
              color: '#64748b',
            }}
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
