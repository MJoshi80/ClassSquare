import React, { useState } from 'react';
import { entitiesApi } from '../api/entities';
import { DownloadIcon, CloseIcon, UploadIcon } from './Icons';
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
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';

export default function CsvUploadModal({ isOpen, onClose, onSuccess }) {
  const [entityType, setEntityType] = useState('rooms');
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreviewData(null);
      setErrorMsg('');
      setSuccessMsg('');
    }
  };

  const handlePreview = async () => {
    if (!file) {
      setErrorMsg('Please select a CSV or Excel file to preview.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await entitiesApi.previewUpload(entityType, file);
      setPreviewData(res.data);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to parse and preview file.');
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!previewData || previewData.valid_rows.length === 0) {
      setErrorMsg('No valid rows available to import.');
      return;
    }
    setCommitting(true);
    setErrorMsg('');
    try {
      const res = await entitiesApi.commitUpload(entityType, previewData.valid_rows);
      setSuccessMsg(res.data.message);
      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 1500);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to commit import.');
    } finally {
      setCommitting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreviewData(null);
    setErrorMsg('');
    setSuccessMsg('');
    onClose();
  };

  return (
    <Dialog
      open={Boolean(isOpen)}
      onClose={handleClose}
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
            Bulk Ingestion Pipeline
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.78rem', mt: 0.25 }}>
            Upload CSV or Excel spreadsheets to parse, validate, and batch import institutional records.
          </Typography>
        </Box>

        <IconButton
          onClick={handleClose}
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
        {errorMsg && (
          <Alert severity="error" sx={{ borderRadius: '12px', fontSize: '0.8rem' }}>
            {errorMsg}
          </Alert>
        )}
        {successMsg && (
          <Alert severity="success" sx={{ borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700 }}>
            {successMsg}
          </Alert>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel id="entity-type-label">Target Entity</InputLabel>
            <Select
              labelId="entity-type-label"
              value={entityType}
              label="Target Entity"
              onChange={(e) => {
                setEntityType(e.target.value);
                setPreviewData(null);
              }}
              sx={{ borderRadius: '10px' }}
            >
              <MenuItem value="departments">Departments</MenuItem>
              <MenuItem value="rooms">Rooms / Labs</MenuItem>
              <MenuItem value="faculty">Faculty</MenuItem>
              <MenuItem value="subjects">Subjects</MenuItem>
              <MenuItem value="batches">Batches</MenuItem>
            </Select>
          </FormControl>

          <Button
            component="a"
            href={entitiesApi.getTemplateUrl(entityType)}
            download
            variant="outlined"
            startIcon={<DownloadIcon className="w-4 h-4" />}
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.78rem',
              bgcolor: '#eff6ff',
              color: '#1d4ed8',
              borderColor: '#bfdbfe',
              '&:hover': { bgcolor: '#dbeafe', borderColor: '#93c5fd' },
            }}
          >
            Download Sample {entityType.toUpperCase()} CSV
          </Button>
        </Box>

        {/* File Dropzone */}
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
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            id="file-upload"
            style={{ display: 'none' }}
          />
          <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'block' }}>
            <UploadIcon className="w-5 h-5 text-primary-600 mx-auto mb-1.5" />
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.82rem' }}>
              {file ? file.name : 'Click to select or drag CSV / Excel file here'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem', mt: 0.5, display: 'block' }}>
              Supported formats: .csv, .xlsx, .xls
            </Typography>
          </label>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="contained"
            onClick={handlePreview}
            disabled={!file || loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.78rem',
              bgcolor: '#0f172a',
              color: '#ffffff',
              '&:hover': { bgcolor: '#1e293b' },
            }}
          >
            {loading ? 'Parsing File...' : 'Preview & Validate'}
          </Button>
        </Box>

        {/* Validation Preview Table */}
        {previewData && (
          <Box sx={{ border: '1px solid #e2e8f0', borderRadius: '12px', p: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.primary', mb: 1.5 }}>
              Parsed Data ({previewData.valid_rows.length} valid, {previewData.errors?.length || 0} errors)
            </Typography>

            {previewData.errors?.length > 0 && (
              <Alert severity="error" sx={{ borderRadius: '10px', mb: 2, fontSize: '0.75rem' }}>
                {previewData.errors.map((e, idx) => (
                  <div key={idx}>Row {e.row}: {e.message}</div>
                ))}
              </Alert>
            )}

            <TableContainer component={Paper} elevation={0} sx={{ maxHeight: 220, border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <Table size="small" stickyHeader>
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    {previewData.valid_rows[0] &&
                      Object.keys(previewData.valid_rows[0]).map((col) => (
                        <TableCell key={col} sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'capitalize', bgcolor: '#f8fafc' }}>
                          {col.replace('_', ' ')}
                        </TableCell>
                      ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewData.valid_rows.slice(0, 10).map((row, idx) => (
                    <TableRow key={idx} hover>
                      {Object.values(row).map((val, cIdx) => (
                        <TableCell key={cIdx} sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          {String(val)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {previewData.valid_rows.length > 10 && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', textAlign: 'center', mt: 1, fontSize: '0.7rem' }}>
                Showing first 10 of {previewData.valid_rows.length} records...
              </Typography>
            )}
          </Box>
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
          color="inherit"
          onClick={handleClose}
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
          onClick={handleCommit}
          disabled={!previewData || previewData.valid_rows.length === 0 || committing}
          startIcon={committing ? <CircularProgress size={16} color="inherit" /> : null}
          sx={{
            borderRadius: '10px',
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.82rem',
            px: 2.5,
            boxShadow: '0 4px 14px rgba(29, 97, 242, 0.35)',
          }}
        >
          {committing ? 'Importing...' : 'Commit to Database'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
