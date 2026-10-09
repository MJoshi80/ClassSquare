import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import TimetableGrid from '../components/TimetableGrid';
import TimetableSyncExportMenu from '../components/TimetableSyncExportMenu';
import SubmitAssignmentModal from '../components/SubmitAssignmentModal';
import VotingOptionPreviewModal from '../components/VotingOptionPreviewModal';
import { entitiesApi } from '../api/entities';
import { timetableApi } from '../api/timetable';
import { exportApi } from '../api/export';
import { classroomApi } from '../api/classroom';
import { votingApi } from '../api/voting';
import {
  CalendarIcon,
  SpreadsheetIcon,
  FileTextIcon,
  PrinterIcon,
  BookIcon,
  ClockIcon,
  CoffeeIcon,
  SparkleIcon,
  CheckCircleIcon,
  FolderIcon,
  ClipboardListIcon,
  MegaphoneIcon,
  UploadIcon,
  DownloadCloudIcon,
  PaperclipIcon,
  AlertTriangleIcon,
  CheckIcon,
  SpinnerIcon,
} from '../components/Icons';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  Button,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';

export default function StudentDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(['timetable', 'voting', 'classroom'].includes(urlTab) ? urlTab : 'timetable');

  const [departments, setDepartments] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedSemester, setSelectedSemester] = useState(3);
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');

  const [scheduleData, setScheduleData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Timetable Voting State
  const [votingSlate, setVotingSlate] = useState(null);
  const [votingLoading, setVotingLoading] = useState(false);
  const [votingSubmitting, setVotingSubmitting] = useState(false);
  const [previewOption, setPreviewOption] = useState(null);

  useEffect(() => {
    const currentTab = searchParams.get('tab');
    if (currentTab && ['timetable', 'voting', 'classroom'].includes(currentTab)) {
      if (currentTab === 'voting' && votingSlate && !votingSlate.is_voting_open) {
        setActiveTab('timetable');
      } else {
        setActiveTab(currentTab);
      }
    }
  }, [searchParams, votingSlate]);

  useEffect(() => {
    if (activeTab === 'voting' && votingSlate && !votingSlate.is_voting_open) {
      setActiveTab('timetable');
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', 'timetable');
        return next;
      });
    }
  }, [votingSlate, activeTab]);

  // Classroom State
  const [materials, setMaterials] = useState([]);
  const [batchSubjects, setBatchSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('all');
  const [classroomLoading, setClassroomLoading] = useState(false);
  const [classroomFilter, setClassroomFilter] = useState('all'); // 'all', 'assignment', 'material', 'announcement'
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [selectedMaterialForSubmit, setSelectedMaterialForSubmit] = useState(null);

  useEffect(() => {
    const loadInit = async () => {
      try {
        const [dRes, bRes] = await Promise.all([
          entitiesApi.getDepartments(),
          entitiesApi.getBatches(),
        ]);
        setDepartments(dRes.data);
        setBatches(bRes.data);

        if (dRes.data.length > 0) {
          setSelectedDeptId(dRes.data[0].id);
        }
      } catch (err) {
        console.error('Failed to load departments/batches', err);
      }
    };
    loadInit();
  }, []);

  const filteredBatches = batches.filter(
    (b) =>
      (!selectedDeptId || b.department_id === Number(selectedDeptId)) &&
      (!selectedSemester || b.semester === Number(selectedSemester))
  );

  useEffect(() => {
    if (filteredBatches.length > 0) {
      if (!filteredBatches.some((b) => b.id === Number(selectedBatchId))) {
        setSelectedBatchId(filteredBatches[0].id);
      }
    } else {
      setSelectedBatchId('');
      setScheduleData(null);
      setMaterials([]);
      setBatchSubjects([]);
    }
  }, [selectedDeptId, selectedSemester, batches]);

  const fetchBatchSchedule = async () => {
    if (!selectedBatchId) return;
    setLoading(true);
    try {
      const res = await timetableApi.getBatchSchedule(selectedBatchId);
      setScheduleData(res.data);
    } catch (err) {
      console.error('Failed to load batch schedule', err);
      setScheduleData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchClassroomMaterials = async () => {
    if (!selectedBatchId) return;
    setClassroomLoading(true);
    try {
      const [matRes, subRes] = await Promise.all([
        classroomApi.getMaterials(selectedBatchId),
        classroomApi.getBatchSubjects(selectedBatchId),
      ]);
      setMaterials(matRes.data);
      setBatchSubjects(subRes.data);
    } catch (err) {
      console.error('Failed to load classroom materials or subjects', err);
    } finally {
      setClassroomLoading(false);
    }
  };

  const fetchVotingSlate = async () => {
    if (!selectedDeptId || !selectedSemester) return;
    setVotingLoading(true);
    try {
      const res = await votingApi.getSlate(Number(selectedDeptId), Number(selectedSemester));
      setVotingSlate(res.data);
    } catch (err) {
      console.error('Failed to load voting slate', err);
      setVotingSlate(null);
    } finally {
      setVotingLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDeptId && selectedSemester) {
      fetchVotingSlate();
    }
  }, [selectedDeptId, selectedSemester]);

  const handleCastVote = async (versionId) => {
    setVotingSubmitting(true);
    try {
      const res = await votingApi.castVote(versionId);
      setVotingSlate(res.data.slate);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to record vote');
    } finally {
      setVotingSubmitting(false);
    }
  };

  useEffect(() => {
    if (selectedBatchId) {
      fetchBatchSchedule();
      fetchClassroomMaterials();
      setSelectedSubjectId('all');
    }
  }, [selectedBatchId]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportIcal = async () => {
    if (!selectedBatchId || !scheduleData) return;
    setExporting(true);
    try {
      await exportApi.downloadBatchIcal(selectedBatchId, scheduleData.batch_name);
    } catch (err) {
      alert('Failed to export calendar');
    } finally {
      setExporting(false);
    }
  };

  const handleExportCsv = async () => {
    if (!scheduleData?.timetable_id) return;
    setExporting(true);
    try {
      await exportApi.downloadTimetableCsv(scheduleData.timetable_id);
    } catch (err) {
      alert('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = async () => {
    if (!scheduleData?.timetable_id) return;
    setExporting(true);
    try {
      await exportApi.downloadTimetableExcel(scheduleData.timetable_id);
    } catch (err) {
      alert('Failed to export Excel');
    } finally {
      setExporting(false);
    }
  };

  const currentBatch = batches.find((b) => b.id === Number(selectedBatchId));

  // Filter materials based on type and selected subject
  const filteredMaterials = materials.filter((m) => {
    if (classroomFilter !== 'all' && m.type !== classroomFilter) return false;
    if (selectedSubjectId !== 'all' && m.subject_id !== Number(selectedSubjectId)) return false;
    return true;
  });

  const pendingAssignmentsCount = materials.filter(
    (m) => m.type === 'assignment' && !m.my_submission
  ).length;

  const currentSelectedSubject = batchSubjects.find((s) => s.id === Number(selectedSubjectId));

  const renderMaterialCard = (item) => {
    const isSubmitted = Boolean(item.my_submission);
    const isOverdue = item.due_date && new Date() > new Date(item.due_date);

    return (
      <Card
        key={item.id}
        variant="outlined"
        sx={{
          borderRadius: '16px',
          borderColor: '#e2e8f0',
          transition: 'all 0.2s',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          '&:hover': {
            boxShadow: '0 10px 25px -5px rgba(16, 42, 107, 0.1)',
            borderColor: '#cbd5e1',
          },
        }}
      >
        <CardContent sx={{ p: 2.5, pb: 1.5 }}>
          {/* Top Badges */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              {item.type === 'assignment' ? (
                <Chip
                  icon={<ClipboardListIcon className="w-3.5 h-3.5 text-purple-700" />}
                  label="ASSIGNMENT"
                  size="small"
                  sx={{
                    bgcolor: '#faf5ff',
                    color: '#7e22ce',
                    border: '1px solid #e9d5ff',
                    fontWeight: 800,
                    fontSize: '0.65rem',
                    height: 22,
                  }}
                />
              ) : item.type === 'material' ? (
                <Chip
                  icon={<FolderIcon className="w-3.5 h-3.5 text-blue-700" />}
                  label="CLASS NOTES"
                  size="small"
                  sx={{
                    bgcolor: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    fontWeight: 800,
                    fontSize: '0.65rem',
                    height: 22,
                  }}
                />
              ) : (
                <Chip
                  icon={<MegaphoneIcon className="w-3.5 h-3.5 text-amber-700" />}
                  label="NOTICE"
                  size="small"
                  sx={{
                    bgcolor: '#fffbeb',
                    color: '#b45309',
                    border: '1px solid #fde68a',
                    fontWeight: 800,
                    fontSize: '0.65rem',
                    height: 22,
                  }}
                />
              )}

              <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', fontSize: '0.75rem' }}>
                {item.subject_name}
              </Typography>
            </Box>

            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
              Instructor: {item.faculty_name}
            </Typography>
          </Box>

          {/* Title */}
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.9rem', lineHeight: 1.3 }}>
            {item.title}
          </Typography>

          {/* Description */}
          {item.description && (
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                fontSize: '0.78rem',
                mt: 1,
                lineHeight: 1.5,
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {item.description}
            </Typography>
          )}

          {/* Due Date Indicator */}
          {item.type === 'assignment' && item.due_date && (
            <Box
              sx={{
                mt: 1.5,
                p: 1.25,
                borderRadius: '10px',
                border: '1px solid',
                borderColor: isOverdue ? '#fecdd3' : '#e9d5ff',
                bgcolor: isOverdue ? '#fff1f2' : '#faf5ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ClockIcon className="w-3.5 h-3.5" style={{ color: isOverdue ? '#e11d48' : '#7e22ce' }} />
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.72rem', color: isOverdue ? '#9f1239' : '#581c87' }}>
                  Deadline: {new Date(item.due_date).toLocaleString()}
                </Typography>
              </Box>
              {isOverdue && !isSubmitted && (
                <Chip
                  label="OVERDUE"
                  size="small"
                  sx={{
                    bgcolor: '#ffe4e6',
                    color: '#9f1239',
                    fontWeight: 800,
                    fontSize: '0.62rem',
                    height: 18,
                  }}
                />
              )}
            </Box>
          )}

          {/* Attached Material File */}
          {item.has_file && (
            <Box
              sx={{
                mt: 1.5,
                p: 1.25,
                bgcolor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, mr: 1 }}>
                <PaperclipIcon className="w-3.5 h-3.5 text-slate-400" />
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.file_name}
                </Typography>
                {item.file_size && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem', flexShrink: 0 }}>
                    ({(item.file_size / 1024).toFixed(1)} KB)
                  </Typography>
                )}
              </Box>
              <Button
                size="small"
                variant="outlined"
                onClick={() => classroomApi.downloadMaterialFile(item.id, item.file_name)}
                startIcon={<DownloadCloudIcon className="w-3.5 h-3.5" />}
                sx={{
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  py: 0.25,
                  px: 1,
                  bgcolor: '#ffffff',
                  borderColor: '#cbd5e1',
                  color: '#334155',
                  flexShrink: 0,
                  '&:hover': { bgcolor: '#f1f5f9' },
                }}
              >
                Download
              </Button>
            </Box>
          )}
        </CardContent>

        {/* Submission Action for Assignments */}
        {item.type === 'assignment' && (
          <Box sx={{ p: 2, pt: 1, borderTop: '1px solid #f1f5f9' }}>
            {isSubmitted ? (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  bgcolor: '#f0fdf4',
                  p: 1.25,
                  borderRadius: '10px',
                  border: '1px solid #bbf7d0',
                }}
              >
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600" />
                    Turned In ({item.my_submission.file_name})
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#15803d', display: 'block', fontSize: '0.68rem', mt: 0.25 }}>
                    Submitted {new Date(item.my_submission.submitted_at).toLocaleString()}
                    {item.my_submission.status === 'late' && <span style={{ color: '#e11d48', fontWeight: 700, marginLeft: 4 }}>(Late)</span>}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setSelectedMaterialForSubmit(item);
                    setSubmitModalOpen(true);
                  }}
                  sx={{
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    bgcolor: '#ffffff',
                    color: '#166534',
                    borderColor: '#86efac',
                    py: 0.5,
                    px: 1.5,
                    '&:hover': { bgcolor: '#dcfce7' },
                  }}
                >
                  Resubmit
                </Button>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AlertTriangleIcon className="w-3.5 h-3.5 text-amber-500" /> Not turned in yet
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  onClick={() => {
                    setSelectedMaterialForSubmit(item);
                    setSubmitModalOpen(true);
                  }}
                  startIcon={<UploadIcon className="w-3.5 h-3.5" />}
                  sx={{
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    py: 0.5,
                    px: 2,
                    boxShadow: '0 4px 12px rgba(29, 97, 242, 0.3)',
                  }}
                >
                  Turn In Work
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Card>
    );
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#e0f2fe', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <Box component="main" sx={{ flex: 1, maxWidth: 1280, width: '100%', mx: 'auto', py: 4, px: { xs: 2, sm: 3, lg: 4 } }}>
        {/* Header (hidden in print) */}
        <Box
          className="no-print"
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: 2,
            mb: 3,
          }}
        >
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em' }}>
              Student Academic Portal
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', mt: 0.25 }}>
              Course schedules, classroom notes, assignments, and academic updates.
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
            {/* Department Selector */}
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="dept-select">Department</InputLabel>
              <Select
                labelId="dept-select"
                value={selectedDeptId}
                label="Department"
                onChange={(e) => setSelectedDeptId(e.target.value)}
                sx={{ borderRadius: '10px', bgcolor: '#ffffff', fontSize: '0.78rem' }}
              >
                {departments.map((d) => (
                  <MenuItem key={d.id} value={d.id} sx={{ fontSize: '0.78rem' }}>
                    {d.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Semester Selector */}
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="sem-select">Semester</InputLabel>
              <Select
                labelId="sem-select"
                value={selectedSemester}
                label="Semester"
                onChange={(e) => setSelectedSemester(Number(e.target.value))}
                sx={{ borderRadius: '10px', bgcolor: '#ffffff', fontSize: '0.78rem' }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                  <MenuItem key={sem} value={sem} sx={{ fontSize: '0.78rem' }}>
                    Semester {sem}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Batch Selector */}
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="batch-select">Cohort / Batch</InputLabel>
              <Select
                labelId="batch-select"
                value={selectedBatchId}
                label="Cohort / Batch"
                onChange={(e) => setSelectedBatchId(e.target.value)}
                sx={{ borderRadius: '10px', bgcolor: '#ffffff', fontSize: '0.78rem' }}
              >
                {batches.map((b) => (
                  <MenuItem key={b.id} value={b.id} sx={{ fontSize: '0.78rem' }}>
                    {b.name}{b.section ? ` (${b.section})` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>

        {/* Dynamic Portal Tabs */}
        <Box className="no-print" sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={(e, val) => {
              setActiveTab(val);
              setSearchParams({ tab: val });
            }}
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                minHeight: 48,
              },
            }}
          >
            <Tab
              value="timetable"
              icon={<CalendarIcon className="w-4 h-4" />}
              iconPosition="start"
              label="Weekly Timetable"
            />
            {votingSlate?.is_voting_open && (
              <Tab
                value="voting"
                icon={<SparkleIcon className="w-4 h-4" />}
                iconPosition="start"
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>Vote on Schedule</span>
                    <Chip
                      label="Active"
                      size="small"
                      sx={{
                        bgcolor: '#ecfdf5',
                        color: '#065f46',
                        border: '1px solid #a7f3d0',
                        fontWeight: 800,
                        fontSize: '0.62rem',
                        height: 18,
                      }}
                    />
                  </Box>
                }
              />
            )}
            <Tab
              value="classroom"
              icon={<FolderIcon className="w-4 h-4" />}
              iconPosition="start"
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>Classroom Hub</span>
                  {materials.length > 0 && (
                    <Chip
                      label={materials.length}
                      size="small"
                      sx={{
                        bgcolor: '#eff6ff',
                        color: '#1d4ed8',
                        fontWeight: 800,
                        fontSize: '0.65rem',
                        height: 18,
                      }}
                    />
                  )}
                  {pendingAssignmentsCount > 0 && (
                    <Chip
                      label={`${pendingAssignmentsCount} due`}
                      size="small"
                      sx={{
                        bgcolor: '#fffbeb',
                        color: '#b45309',
                        fontWeight: 800,
                        fontSize: '0.62rem',
                        height: 18,
                      }}
                    />
                  )}
                </Box>
              }
            />
          </Tabs>
        </Box>

        {/* TAB 1: Timetable & Gap-Time Analysis */}
        {activeTab === 'timetable' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {loading ? (
              <Box sx={{ py: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <CircularProgress size={32} />
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                  Loading official timetable matrix...
                </Typography>
              </Box>
            ) : !scheduleData ? (
              <Paper
                elevation={0}
                sx={{
                  p: 6,
                  borderRadius: '20px',
                  border: '1px solid #e2e8f0',
                  textAlign: 'center',
                }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '12px',
                    bgcolor: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  <CalendarIcon className="w-5 h-5 text-slate-400" />
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary' }}>
                  No Timetable Scheduled
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', mt: 0.5, maxWidth: 420, mx: 'auto' }}>
                  No active timetable has been approved by the department HOD for Batch{' '}
                  {currentBatch?.name || 'this batch'} yet.
                </Typography>
              </Paper>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Highlights Stats */}
                <Box
                  className="no-print"
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
                    gap: 2,
                  }}
                >
                  <Card variant="outlined" sx={{ borderRadius: '16px', p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: '#eff6ff', color: '#1d61f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <BookIcon className="w-5 h-5 text-blue-600" />
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, color: 'text.secondary', fontSize: '0.68rem' }}>
                          Weekly Classes
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.2 }}>
                          {scheduleData.total_classes} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#64748b' }}>periods</span>
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>Monday – Friday</Typography>
                      </Box>
                    </Box>
                  </Card>

                  <Card variant="outlined" sx={{ borderRadius: '16px', p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ClockIcon className="w-5 h-5 text-emerald-600" />
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, color: 'text.secondary', fontSize: '0.68rem' }}>
                          Daily Average
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.2 }}>
                          {(scheduleData.total_classes / 5).toFixed(1)} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#64748b' }}>hrs/day</span>
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>Regular 6-period shift</Typography>
                      </Box>
                    </Box>
                  </Card>

                  <Card variant="outlined" sx={{ borderRadius: '16px', p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CoffeeIcon className="w-5 h-5 text-amber-600" />
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, color: 'text.secondary', fontSize: '0.68rem' }}>
                          Study Gaps
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.2 }}>
                          {scheduleData.gap_hours ?? scheduleData.total_gap_periods ?? 0}{' '}
                          <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#64748b' }}>hours</span>
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>Between scheduled classes</Typography>
                      </Box>
                    </Box>
                  </Card>

                  <Card variant="outlined" sx={{ borderRadius: '16px', p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <SparkleIcon className="w-5 h-5 text-indigo-600" />
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, color: 'text.secondary', fontSize: '0.68rem' }}>
                          Schedule Density
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.2 }}>
                          {Math.round(((scheduleData.total_classes || 0) / 30) * 100)}%
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>Balanced load distribution</Typography>
                      </Box>
                    </Box>
                  </Card>
                </Box>

                {/* Schedule Grid Display */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: '20px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary' }}>
                        Batch {scheduleData.batch_name} Official Weekly Schedule
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Option {scheduleData.option_rank || 1} · Generated by ClassSquare Solver
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Chip
                        icon={<CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600" />}
                        label="Official Active Schedule"
                        size="small"
                        sx={{
                          bgcolor: '#ecfdf5',
                          color: '#065f46',
                          border: '1px solid #a7f3d0',
                          fontWeight: 800,
                          fontSize: '0.72rem',
                          height: 24,
                        }}
                      />
                      <TimetableSyncExportMenu
                        scheduleTitle={`Batch ${scheduleData.batch_name} Official Weekly Schedule (Option ${scheduleData.option_rank || 1})`}
                        onSyncIcal={handleExportIcal}
                        onExportExcel={handleExportExcel}
                        onExportCsv={handleExportCsv}
                        onPrint={handlePrint}
                        disabled={exporting || !scheduleData?.timetable_id}
                      />
                    </Box>
                  </Box>

                  <TimetableGrid slots={scheduleData.slots} readonly={true} />
                </Paper>
              </Box>
            )}
          </Box>
        )}

        {/* TAB 2: Voting on Schedule */}
        {activeTab === 'voting' && votingSlate?.is_voting_open && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Status Banner */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: '20px',
                border: '1px solid',
                borderColor: votingSlate?.is_voting_open ? '#a7f3d0' : '#e2e8f0',
                bgcolor: votingSlate?.is_voting_open ? '#f0fdf4' : '#ffffff',
                boxShadow: '0 10px 25px -5px rgba(16, 42, 107, 0.05)',
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: '12px',
                      bgcolor: votingSlate?.is_voting_open ? '#16a34a' : '#f1f5f9',
                      color: votingSlate?.is_voting_open ? '#ffffff' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {votingSlate?.is_voting_open ? <SparkleIcon className="w-5 h-5 text-white" /> : <ClockIcon className="w-5 h-5 text-slate-500" />}
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', fontSize: '1rem' }}>
                        {departments.find((d) => d.id === Number(selectedDeptId))?.name || 'Department'} — Semester {selectedSemester} Timetable Voting
                      </Typography>
                      {votingSlate?.is_voting_open ? (
                        <Chip
                          label="VOTING ACTIVE"
                          size="small"
                          sx={{
                            bgcolor: '#dcfce7',
                            color: '#15803d',
                            fontWeight: 800,
                            fontSize: '0.65rem',
                            height: 20,
                          }}
                        />
                      ) : (
                        <Chip
                          label="VOTING CLOSED"
                          size="small"
                          sx={{
                            bgcolor: '#f1f5f9',
                            color: '#475569',
                            fontWeight: 800,
                            fontSize: '0.65rem',
                            height: 20,
                          }}
                        />
                      )}
                    </Box>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.78rem', mt: 0.5, maxWidth: 680, lineHeight: 1.5 }}>
                      {votingSlate?.is_voting_open
                        ? 'Review candidate timetable schedules generated by the HOD for your cohort. Compare free study gaps and subject distributions, and vote for your favorite schedule. Voting automatically concludes as soon as the HOD officially approves an option.'
                        : `The HOD has approved and published Option ${votingSlate?.approved_option_rank || 1} as the official academic timetable. Student voting has closed.`}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1 }}>
                    {votingSlate?.total_votes || 0}
                  </Typography>
                  <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'text.secondary', fontSize: '0.65rem' }}>
                    Total Student Votes
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* Candidate Options Grid */}
            {votingLoading ? (
              <Box sx={{ py: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <CircularProgress size={32} />
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                  Fetching candidate timetable options...
                </Typography>
              </Box>
            ) : !votingSlate || votingSlate.options.length === 0 ? (
              <Paper
                elevation={0}
                sx={{
                  p: 6,
                  borderRadius: '20px',
                  border: '1px solid #e2e8f0',
                  textAlign: 'center',
                }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '12px',
                    bgcolor: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  <CalendarIcon className="w-5 h-5 text-slate-400" />
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary' }}>
                  No Candidate Options Open for Voting
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', mt: 0.5, maxWidth: 420, mx: 'auto' }}>
                  No draft timetable options have been generated for {departments.find((d) => d.id === Number(selectedDeptId))?.name || 'this department'} Semester {selectedSemester} yet.
                </Typography>
              </Paper>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' }, gap: 3 }}>
                {votingSlate.options.slice(0, 3).map((opt) => {
                  const isApprovedWinner = !votingSlate.is_voting_open && opt.id === votingSlate.approved_version_id;
                  const isUserPick = opt.is_user_vote;

                  return (
                    <Card
                      key={opt.id}
                      variant="outlined"
                      sx={{
                        borderRadius: '20px',
                        borderColor: isApprovedWinner ? '#86efac' : isUserPick ? '#93c5fd' : '#e2e8f0',
                        boxShadow: isApprovedWinner || isUserPick ? '0 8px 24px -4px rgba(29, 97, 242, 0.15)' : 'none',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      {isApprovedWinner && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            bgcolor: '#16a34a',
                            color: '#ffffff',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            px: 1.5,
                            py: 0.5,
                            borderBottomLeftRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                          }}
                        >
                          <CheckCircleIcon className="w-3 h-3 text-white" /> APPROVED SCHEDULE
                        </Box>
                      )}

                      <CardContent sx={{ p: 3, pb: 1.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, gap: 1 }}>
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                              <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', fontSize: '1.05rem' }}>
                                Option {opt.option_rank}
                              </Typography>
                              {isUserPick && (
                                <Chip
                                  icon={<CheckIcon className="w-3 h-3 text-blue-600" />}
                                  label="Your Vote"
                                  size="small"
                                  sx={{
                                    bgcolor: '#eff6ff',
                                    color: '#1d4ed8',
                                    border: '1px solid #bfdbfe',
                                    fontWeight: 800,
                                    fontSize: '0.65rem',
                                    height: 20,
                                  }}
                                />
                              )}
                            </Box>
                            {opt.optimization_focus && (
                              <Typography variant="caption" sx={{ color: '#2563eb', fontWeight: 700, fontSize: '0.72rem', display: 'block', mt: 0.25 }}>
                                {opt.optimization_focus}
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        {/* Three Student-Centric Key Highlights */}
                        {(() => {
                          const DEFAULT_STUDENT_POINTS = {
                            1: [
                              {
                                title: 'Even Daily Study Pacing',
                                description: 'Lectures are distributed evenly across Monday to Friday, preventing exhausting 6-period overload days.',
                              },
                              {
                                title: 'Predictable Lunch & Library Breaks',
                                description: 'Consistent 1-hour gaps between sessions provide reliable time for meals, coursework, and quiet library study.',
                              },
                              {
                                title: 'Balanced Theory & Lab Routine',
                                description: 'Hands-on practicals and theory classes alternate smoothly to maintain a steady, sustainable daily pace.',
                              },
                            ],
                            2: [
                              {
                                title: 'Continuous Afternoon Free Windows',
                                description: 'Lectures are concentrated earlier in the day, opening 2–3 hour afternoon blocks for group projects and self-study.',
                              },
                              {
                                title: 'Direct Faculty Mentorship Access',
                                description: 'Professors have dedicated office hours right after classes for 1-on-1 doubt clearing and project guidance.',
                              },
                              {
                                title: 'Distributed Weekly Assignment Pacing',
                                description: 'Core subject classes meet on alternating days, preventing overlapping homework deadlines and test congestion.',
                              },
                            ],
                            3: [
                              {
                                title: 'Zero Midday Waiting Downtime',
                                description: 'Classes are scheduled back-to-back with minimal empty hours, eliminating idle waiting between classes on campus.',
                              },
                              {
                                title: '100% Morning Laboratory Sessions',
                                description: 'Intensive practical lab sessions are scheduled in fresh morning periods (Periods 1–3) for peak focus.',
                              },
                              {
                                title: 'Early Afternoon Dismissal',
                                description: 'Academic sessions finish early in the afternoon, giving you maximum daylight hours for commuting, rest, and sports.',
                              },
                            ],
                          };

                          const studentPoints =
                            opt.student_centric_points && opt.student_centric_points.length === 3
                              ? opt.student_centric_points
                              : DEFAULT_STUDENT_POINTS[opt.option_rank] || DEFAULT_STUDENT_POINTS[1];

                          return (
                            <Box sx={{ my: 2.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                              <Typography
                                variant="caption"
                                sx={{
                                  fontWeight: 800,
                                  color: '#475569',
                                  fontSize: '0.72rem',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em',
                                }}
                              >
                                Student-Centric Schedule Highlights:
                              </Typography>
                              {studentPoints.map((pt, pIdx) => (
                                <Box
                                  key={pIdx}
                                  sx={{
                                    p: 1.5,
                                    borderRadius: '12px',
                                    bgcolor: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 1.5,
                                  }}
                                >
                                  <Box
                                    sx={{
                                      width: 24,
                                      height: 24,
                                      borderRadius: '8px',
                                      bgcolor: '#dbeafe',
                                      color: '#1d4ed8',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 900,
                                      fontSize: '0.75rem',
                                      flexShrink: 0,
                                      mt: 0.25,
                                    }}
                                  >
                                    {pIdx + 1}
                                  </Box>
                                  <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.82rem', lineHeight: 1.25 }}>
                                      {pt.title}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.74rem', mt: 0.35, lineHeight: 1.45 }}>
                                      {pt.description}
                                    </Typography>
                                  </Box>
                                </Box>
                              ))}
                            </Box>
                          );
                        })()}

                        {/* Live Vote Progress */}
                        <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                              Student Preference
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main' }}>
                              {opt.vote_count} vote{opt.vote_count !== 1 ? 's' : ''} ({opt.vote_percentage}%)
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={opt.vote_percentage}
                            sx={{
                              height: 8,
                              borderRadius: 4,
                              bgcolor: '#e2e8f0',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 4,
                                bgcolor: 'primary.main',
                              },
                            }}
                          />
                        </Box>
                      </CardContent>

                      {/* Actions */}
                      <Box sx={{ p: 2.5, pt: 1, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 1.5 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          fullWidth
                          onClick={() => setPreviewOption(opt)}
                          startIcon={<SpreadsheetIcon className="w-3.5 h-3.5" />}
                          sx={{
                            borderRadius: '10px',
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            color: '#475569',
                            borderColor: '#cbd5e1',
                          }}
                        >
                          Preview Matrix
                        </Button>

                        {votingSlate.is_voting_open ? (
                          <Button
                            variant="contained"
                            size="small"
                            fullWidth
                            disabled={votingSubmitting || isUserPick}
                            onClick={() => handleCastVote(opt.id)}
                            startIcon={isUserPick ? <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600" /> : <SparkleIcon className="w-3.5 h-3.5" />}
                            sx={{
                              borderRadius: '10px',
                              textTransform: 'none',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              bgcolor: isUserPick ? '#ecfdf5' : 'primary.main',
                              color: isUserPick ? '#166534' : '#ffffff',
                              border: isUserPick ? '1px solid #a7f3d0' : 'none',
                              boxShadow: isUserPick ? 'none' : '0 4px 12px rgba(29, 97, 242, 0.3)',
                              '&:hover': {
                                bgcolor: isUserPick ? '#ecfdf5' : 'primary.dark',
                              },
                            }}
                          >
                            {isUserPick ? 'Voted' : `Vote for Option ${opt.option_rank}`}
                          </Button>
                        ) : (
                          <Button
                            variant="outlined"
                            size="small"
                            fullWidth
                            disabled
                            sx={{
                              borderRadius: '10px',
                              textTransform: 'none',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                            }}
                          >
                            Voting Closed
                          </Button>
                        )}
                      </Box>
                    </Card>
                  );
                })}
              </Box>
            )}
          </Box>
        )}

        {/* TAB 3: Classroom Hub */}
        {activeTab === 'classroom' && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '280px 1fr' }, gap: 3, alignItems: 'flex-start' }}>
            {/* Left Sidebar: Course Streams */}
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: '20px',
                border: '1px solid #e2e8f0',
                bgcolor: '#ffffff',
                position: { md: 'sticky' },
                top: { md: '84px' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2, pb: 1.5, borderBottom: '1px solid #f1f5f9' }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '8px',
                    bgcolor: '#eff6ff',
                    color: '#1d61f2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BookIcon className="w-4 h-4" />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.88rem', lineHeight: 1.2 }}>
                    Course Streams
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    Batch {currentBatch?.name || 'Selected'} ({batchSubjects.length} enrolled)
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Button
                  fullWidth
                  onClick={() => setSelectedSubjectId('all')}
                  sx={{
                    justifyContent: 'space-between',
                    textAlign: 'left',
                    py: 1,
                    px: 1.5,
                    borderRadius: '12px',
                    textTransform: 'none',
                    bgcolor: selectedSubjectId === 'all' ? '#eff6ff' : 'transparent',
                    border: selectedSubjectId === 'all' ? '1px solid #bfdbfe' : '1px solid transparent',
                    color: selectedSubjectId === 'all' ? '#1d61f2' : '#334155',
                    fontWeight: selectedSubjectId === 'all' ? 800 : 600,
                    fontSize: '0.8rem',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      bgcolor: selectedSubjectId === 'all' ? '#eff6ff' : '#f8fafc',
                    },
                  }}
                >
                  <span>All Subjects</span>
                  <Chip
                    label={materials.length}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      bgcolor: selectedSubjectId === 'all' ? '#dbeafe' : '#f1f5f9',
                      color: selectedSubjectId === 'all' ? '#1e40af' : '#475569',
                      borderRadius: '6px',
                    }}
                  />
                </Button>

                {batchSubjects.map((sub) => {
                  const isSelected = selectedSubjectId === sub.id;
                  return (
                    <Button
                      key={sub.id}
                      fullWidth
                      onClick={() => setSelectedSubjectId(sub.id)}
                      sx={{
                        justifyContent: 'space-between',
                        textAlign: 'left',
                        py: 1,
                        px: 1.5,
                        borderRadius: '12px',
                        textTransform: 'none',
                        bgcolor: isSelected ? '#eff6ff' : 'transparent',
                        border: isSelected ? '1px solid #bfdbfe' : '1px solid transparent',
                        color: isSelected ? '#1d61f2' : '#334155',
                        fontWeight: isSelected ? 800 : 600,
                        fontSize: '0.8rem',
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          bgcolor: isSelected ? '#eff6ff' : '#f8fafc',
                        },
                      }}
                    >
                      <Box sx={{ minWidth: 0, mr: 1 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontSize: '0.78rem',
                            fontWeight: isSelected ? 800 : 600,
                            color: isSelected ? '#1d61f2' : '#334155',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'block',
                          }}
                        >
                          {sub.name}
                        </Typography>
                        {sub.code && (
                          <Typography variant="caption" sx={{ fontSize: '0.66rem', color: isSelected ? '#3b82f6' : '#94a3b8' }}>
                            {sub.code}
                          </Typography>
                        )}
                      </Box>
                      <Chip
                        label={sub.total_materials || 0}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          bgcolor: isSelected ? '#dbeafe' : '#f1f5f9',
                          color: isSelected ? '#1e40af' : '#475569',
                          borderRadius: '6px',
                          flexShrink: 0,
                        }}
                      />
                    </Button>
                  );
                })}
              </Box>
            </Paper>

            {/* Right Column: Filters & Content */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, minWidth: 0 }}>
              {/* Type Filters */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 1.5,
                  p: 2,
                  bgcolor: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', mr: 0.5 }}>
                    Type:
                  </Typography>
                  {[
                    { id: 'all', label: 'All Items' },
                    { id: 'assignment', label: 'Assignments' },
                    { id: 'material', label: 'Class Notes / PDFs' },
                    { id: 'announcement', label: 'Notices' },
                  ].map((f) => (
                    <Chip
                      key={f.id}
                      clickable
                      label={f.label}
                      color={classroomFilter === f.id ? 'primary' : 'default'}
                      variant={classroomFilter === f.id ? 'filled' : 'outlined'}
                      onClick={() => setClassroomFilter(f.id)}
                      sx={{ fontWeight: 700, fontSize: '0.72rem' }}
                    />
                  ))}
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', fontWeight: 600 }}>
                  Showing {filteredMaterials.length} item{filteredMaterials.length !== 1 ? 's' : ''}
                </Typography>
              </Box>

              {/* Items Grid */}
              {classroomLoading ? (
                <Box sx={{ py: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <CircularProgress size={32} />
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                    Loading coursework, syllabus notes, and assignments...
                  </Typography>
                </Box>
              ) : filteredMaterials.length === 0 ? (
                <Paper elevation={0} sx={{ p: 6, borderRadius: '20px', border: '1px solid #e2e8f0', textAlign: 'center', bgcolor: '#ffffff' }}>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: '12px',
                      bgcolor: '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2,
                    }}
                  >
                    <FolderIcon className="w-5 h-5 text-slate-400" />
                  </Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary' }}>
                    No Class Materials Posted Yet
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', mt: 0.5 }}>
                    Instructors have not posted materials or assignments matching this criteria yet.
                  </Typography>
                </Paper>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' }, gap: 2.5 }}>
                  {filteredMaterials.map(renderMaterialCard)}
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* Student Turn-In Modal */}
      <SubmitAssignmentModal
        isOpen={submitModalOpen}
        onClose={() => {
          setSubmitModalOpen(false);
          setSelectedMaterialForSubmit(null);
        }}
        material={selectedMaterialForSubmit}
        onSubmitted={fetchClassroomMaterials}
      />

      {/* Candidate Option Schedule Preview Modal */}
      <VotingOptionPreviewModal
        isOpen={Boolean(previewOption)}
        onClose={() => setPreviewOption(null)}
        option={previewOption}
        onVote={handleCastVote}
        isVotingOpen={votingSlate?.is_voting_open}
        isUserVote={previewOption?.is_user_vote}
      />
    </Box>
  );
}
