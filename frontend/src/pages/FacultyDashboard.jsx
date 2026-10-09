import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import TimetableGrid from '../components/TimetableGrid';
import TimetableSyncExportMenu from '../components/TimetableSyncExportMenu';
import CreateMaterialModal from '../components/CreateMaterialModal';
import SubmissionsModal from '../components/SubmissionsModal';
import { leaveApi } from '../api/leave';
import { entitiesApi } from '../api/entities';
import { classroomApi } from '../api/classroom';
import { useAuth } from '../contexts/AuthContext';
import { exportApi } from '../api/export';
import {
  CalendarIcon,
  UserCheckIcon,
  BookIcon,
  ClockIcon,
  SpreadsheetIcon,
  FolderIcon,
  ClipboardListIcon,
  MegaphoneIcon,
  UploadIcon,
  DownloadCloudIcon,
  PaperclipIcon,
  PrinterIcon,
  CloseIcon,
  UsersIcon,
} from '../components/Icons';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Alert,
  CircularProgress,
} from '@mui/material';

export default function FacultyDashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(['schedule', 'classroom'].includes(urlTab) ? urlTab : 'schedule');

  useEffect(() => {
    const currentTab = searchParams.get('tab');
    if (currentTab && ['schedule', 'classroom'].includes(currentTab)) {
      setActiveTab(currentTab);
    }
  }, [searchParams]);
  const [scheduleSlots, setScheduleSlots] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [batches, setBatches] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [currentFaculty, setCurrentFaculty] = useState(null);

  // Classroom State
  const [materials, setMaterials] = useState([]);
  const [classroomFilter, setClassroomFilter] = useState('all');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('all');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('all');
  const [createMaterialModalOpen, setCreateMaterialModalOpen] = useState(false);
  const [submissionsModalOpen, setSubmissionsModalOpen] = useState(false);
  const [selectedMaterialForSubs, setSelectedMaterialForSubs] = useState(null);
  const [classroomLoading, setClassroomLoading] = useState(false);

  // Leave Application Modal
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [leaveSuccess, setLeaveSuccess] = useState('');

  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [facRes, schedRes, leavesRes, batchRes, subjRes] = await Promise.all([
        entitiesApi.getFaculty(),
        leaveApi.getMySchedule(),
        leaveApi.getLeaves(),
        entitiesApi.getBatches(),
        entitiesApi.getSubjects(),
      ]);
      setFacultyList(facRes.data);
      setScheduleSlots(schedRes.data);
      setLeaves(leavesRes.data);
      setBatches(batchRes.data);
      setSubjects(subjRes.data);

      let facObj = null;
      if (user?.linked_faculty_id) {
        facObj = facRes.data.find((f) => f.id === user.linked_faculty_id);
      } else if (facRes.data.length > 0) {
        facObj = facRes.data[0];
      }
      setCurrentFaculty(facObj || null);
    } catch (err) {
      console.error('Failed to load faculty dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMaterials = async () => {
    setClassroomLoading(true);
    try {
      const res = await classroomApi.getMaterials(null, currentFaculty?.id);
      setMaterials(res.data);
    } catch (err) {
      console.error('Failed to load classroom materials', err);
    } finally {
      setClassroomLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    if (currentFaculty) {
      loadMaterials();
    }
  }, [currentFaculty]);

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (!currentFaculty) return;
    setSubmittingLeave(true);
    setLeaveError('');
    setLeaveSuccess('');
    try {
      await leaveApi.applyLeave(currentFaculty.id, leaveDate, leaveReason);
      setLeaveSuccess('Leave application submitted successfully. HOD will review and assign a substitute.');
      setLeaveDate('');
      setLeaveReason('');
      setTimeout(() => {
        setLeaveModalOpen(false);
        setLeaveSuccess('');
      }, 1500);
      fetchData();
    } catch (err) {
      setLeaveError(err.response?.data?.detail || 'Failed to submit leave application.');
    } finally {
      setSubmittingLeave(false);
    }
  };

  const handleDeleteMaterial = async (id) => {
    if (!window.confirm('Are you sure you want to delete this coursework item? Any student submissions will also be deleted.')) {
      return;
    }
    try {
      await classroomApi.deleteMaterial(id);
      loadMaterials();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete material');
    }
  };

  const statusBadge = (status) => {
    if (status === 'approved') return { bgcolor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' };
    if (status === 'substituted') return { bgcolor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' };
    if (status === 'rejected') return { bgcolor: '#fff1f2', color: '#9f1239', border: '1px solid #fecdd3' };
    return { bgcolor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' };
  };

  const totalWeeklyLoad = scheduleSlots.length;
  const todayDayIdx = new Date().getDay() - 1;
  const classesToday = scheduleSlots.filter((s) => s.day === todayDayIdx).length;
  const pendingLeavesCount = leaves.filter((l) => l.status === 'pending').length;

  const filteredMaterials = materials.filter((m) => {
    if (classroomFilter !== 'all' && m.type !== classroomFilter) return false;
    if (selectedBatchFilter !== 'all' && m.batch_id !== Number(selectedBatchFilter)) return false;
    if (selectedSubjectFilter !== 'all' && m.subject_id !== Number(selectedSubjectFilter)) return false;
    return true;
  });

  // Compute subjects taught by this faculty member
  const taughtSubjectIdSet = new Set([
    ...(currentFaculty?.subject_ids || (currentFaculty?.subjects || []).map((s) => s.id)),
    ...scheduleSlots.map((slot) => slot.subject_id).filter(Boolean),
  ]);

  const facultyTaughtSubjects = subjects.filter((s) => taughtSubjectIdSet.has(s.id));

  // Batches where faculty has assigned courses
  const facultyTaughtBatches = batches.filter((b) =>
    facultyTaughtSubjects.some((s) => s.department_id === b.department_id && s.semester === b.semester)
  );

  const availableSubjectsForFilter = (facultyTaughtSubjects.length > 0 ? facultyTaughtSubjects : subjects).filter((s) => {
    if (selectedBatchFilter === 'all') return true;
    const batchObj = batches.find((b) => b.id === Number(selectedBatchFilter));
    if (!batchObj) return true;
    return s.department_id === batchObj.department_id && s.semester === batchObj.semester;
  });

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#e0f2fe', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <Box component="main" sx={{ flex: 1, maxWidth: 1280, width: '100%', mx: 'auto', py: 4, px: { xs: 2, sm: 3, lg: 4 } }}>
        {/* Header */}
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
              Faculty Teaching Portal {currentFaculty ? `— ${currentFaculty.name}` : ''}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', mt: 0.25 }}>
              {currentFaculty?.department_name || 'Academic Department'} · Real-time timetable schedule, leave management & classroom hub
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Button
              size="small"
              variant="contained"
              color="primary"
              onClick={() => setCreateMaterialModalOpen(true)}
              startIcon={<UploadIcon className="w-4 h-4" />}
              sx={{
                borderRadius: '10px',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.78rem',
                boxShadow: '0 4px 12px rgba(29, 97, 242, 0.3)',
              }}
            >
              + Post Material / Assignment
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setLeaveModalOpen(true)}
              sx={{
                borderRadius: '10px',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.78rem',
                bgcolor: '#ffffff',
                borderColor: '#cbd5e1',
                color: '#334155',
                '&:hover': { bgcolor: '#f8fafc' },
              }}
            >
              + Apply for Leave
            </Button>
          </Box>
        </Box>

        {/* Tab Navigation */}
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
              value="schedule"
              icon={<CalendarIcon className="w-4 h-4" />}
              iconPosition="start"
              label="Weekly Schedule & Leaves"
            />
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
                </Box>
              }
            />
          </Tabs>
        </Box>

        {/* TAB 1: Schedule & Leaves */}
        {activeTab === 'schedule' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Stat Cards */}
            <Box
              className="no-print"
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                gap: 2,
              }}
            >
              <Card variant="outlined" sx={{ borderRadius: '16px', p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: '#eff6ff', color: '#1d61f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <SpreadsheetIcon className="w-5 h-5 text-blue-600" />
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, color: 'text.secondary', fontSize: '0.68rem' }}>
                      Weekly Load
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.2 }}>
                      {totalWeeklyLoad} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#64748b' }}>classes / week</span>
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>
                      Max permitted: {currentFaculty?.max_classes_per_week || 16}
                    </Typography>
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
                      Classes Today
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.2 }}>
                      {classesToday} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#64748b' }}>sessions</span>
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>
                      {todayDayIdx >= 0 && todayDayIdx < 5 ? 'Scheduled for today' : 'Weekend (no classes)'}
                    </Typography>
                  </Box>
                </Box>
              </Card>

              <Card variant="outlined" sx={{ borderRadius: '16px', p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CalendarIcon className="w-5 h-5 text-amber-600" />
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, color: 'text.secondary', fontSize: '0.68rem' }}>
                      Leave Status
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.2 }}>
                      {pendingLeavesCount} <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#d97706' }}>pending</span>
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>
                      {leaves.length} total applications recorded
                    </Typography>
                  </Box>
                </Box>
              </Card>
            </Box>

            {/* Weekly Schedule Section */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary' }}>
                    My Weekly Class Schedule
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Synchronized with institutional active timetable
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TimetableSyncExportMenu
                    scheduleTitle={`Faculty Schedule — ${currentFaculty?.name || 'Teaching'}`}
                    onSyncIcal={currentFaculty ? () => exportApi.downloadFacultyIcal(currentFaculty.id, currentFaculty.name) : null}
                    onPrint={() => window.print()}
                  />
                </Box>
              </Box>

              {scheduleSlots.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', fontSize: '0.8rem' }}>
                  No approved timetable scheduled for your profile yet.
                </Typography>
              ) : (
                <TimetableGrid slots={scheduleSlots} readonly={true} />
              )}
            </Paper>

            {/* Leave Applications Table */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary', mb: 2 }}>
                My Leave Applications & Substitutions
              </Typography>
              {leaves.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', fontSize: '0.8rem' }}>
                  No leave requests filed yet.
                </Typography>
              ) : (
                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.78rem', py: 1.5 }}>Leave Date</TableCell>
                        <TableCell sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.78rem', py: 1.5 }}>Affected Classes</TableCell>
                        <TableCell sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.78rem', py: 1.5 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.78rem', py: 1.5 }}>Assigned Substitute</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {leaves.map((l) => (
                        <TableRow key={l.id} hover>
                          <TableCell sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.8rem' }}>{l.date}</TableCell>
                          <TableCell sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>{l.affected_slots_count} class periods</TableCell>
                          <TableCell>
                            <Chip
                              label={l.status}
                              size="small"
                              sx={{
                                ...statusBadge(l.status),
                                fontWeight: 800,
                                fontSize: '0.68rem',
                                textTransform: 'capitalize',
                                height: 20,
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            {l.substitute_name ? (
                              <Chip
                                icon={<UserCheckIcon className="w-3 h-3 text-emerald-600" />}
                                label={l.substitute_name}
                                size="small"
                                sx={{
                                  bgcolor: '#ecfdf5',
                                  color: '#065f46',
                                  border: '1px solid #a7f3d0',
                                  fontWeight: 700,
                                  fontSize: '0.68rem',
                                  height: 20,
                                }}
                              />
                            ) : (
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                                None assigned
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Box>
        )}

        {/* TAB 2: Classroom Hub */}
        {activeTab === 'classroom' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Filter controls */}
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BookIcon className="w-4 h-4 text-primary-600" />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.primary', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem' }}>
                    Coursework Streams
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Showing <strong>{filteredMaterials.length}</strong> of {materials.length} posted coursework items
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id="batch-filter">Cohort Batch</InputLabel>
                  <Select
                    labelId="batch-filter"
                    value={selectedBatchFilter}
                    label="Cohort Batch"
                    onChange={(e) => {
                      setSelectedBatchFilter(e.target.value);
                      setSelectedSubjectFilter('all');
                    }}
                    sx={{ borderRadius: '10px', fontSize: '0.78rem' }}
                  >
                    <MenuItem value="all">All Cohorts ({batches.length})</MenuItem>
                    {batches.map((b) => (
                      <MenuItem key={b.id} value={b.id} sx={{ fontSize: '0.78rem' }}>
                        Batch {b.name} (Sem {b.semester})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id="subj-filter">Course Subject</InputLabel>
                  <Select
                    labelId="subj-filter"
                    value={selectedSubjectFilter}
                    label="Course Subject"
                    onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                    sx={{ borderRadius: '10px', fontSize: '0.78rem' }}
                  >
                    <MenuItem value="all">All Subjects</MenuItem>
                    {availableSubjectsForFilter.map((s) => (
                      <MenuItem key={s.id} value={s.id} sx={{ fontSize: '0.78rem' }}>
                        {s.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'material', label: 'Notes' },
                    { id: 'assignment', label: 'Assignments' },
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
              </Box>
            </Paper>

            {/* Coursework Cards */}
            {classroomLoading ? (
              <Box sx={{ py: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <CircularProgress size={32} />
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                  Loading coursework items...
                </Typography>
              </Box>
            ) : filteredMaterials.length === 0 ? (
              <Paper elevation={0} sx={{ p: 6, borderRadius: '20px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
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
                  No Materials or Assignments Found
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', mt: 0.5 }}>
                  Click "+ Post Material / Assignment" above to upload lecture slides or coursework tasks.
                </Typography>
              </Paper>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2.5 }}>
                {filteredMaterials.map((m) => (
                  <Card
                    key={m.id}
                    variant="outlined"
                    sx={{
                      borderRadius: '16px',
                      borderColor: '#e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: '0 8px 24px -4px rgba(16, 42, 107, 0.08)',
                      },
                    }}
                  >
                    <CardContent sx={{ p: 2.5, pb: 1.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {m.type === 'assignment' ? (
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
                          ) : m.type === 'material' ? (
                            <Chip
                              icon={<FolderIcon className="w-3.5 h-3.5 text-blue-700" />}
                              label="NOTES"
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
                            {m.subject_name}
                          </Typography>
                        </Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                          Batch {m.batch_name}
                        </Typography>
                      </Box>

                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.92rem' }}>
                        {m.title}
                      </Typography>

                      {m.description && (
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.78rem', mt: 1, lineHeight: 1.4 }}>
                          {m.description}
                        </Typography>
                      )}

                      {m.due_date && (
                        <Box sx={{ mt: 1.5, p: 1, bgcolor: '#faf5ff', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
                          <Typography variant="caption" sx={{ color: '#7e22ce', fontWeight: 700, fontSize: '0.72rem' }}>
                            Due: {new Date(m.due_date).toLocaleString()}
                          </Typography>
                        </Box>
                      )}

                      {m.has_file && (
                        <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1, bgcolor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mr: 1 }}>
                            {m.file_name}
                          </Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => classroomApi.downloadMaterialFile(m.id, m.file_name)}
                            startIcon={<DownloadCloudIcon className="w-3 h-3" />}
                            sx={{
                              borderRadius: '6px',
                              textTransform: 'none',
                              fontWeight: 700,
                              fontSize: '0.68rem',
                              py: 0.25,
                              px: 1,
                              borderColor: '#cbd5e1',
                              color: '#334155',
                            }}
                          >
                            Download
                          </Button>
                        </Box>
                      )}
                    </CardContent>

                    <Box sx={{ p: 2, pt: 1, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {m.type === 'assignment' ? (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setSelectedMaterialForSubs(m);
                            setSubmissionsModalOpen(true);
                          }}
                          startIcon={<UsersIcon className="w-3.5 h-3.5" />}
                          sx={{
                            borderRadius: '8px',
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            bgcolor: '#faf5ff',
                            color: '#7e22ce',
                            borderColor: '#d8b4fe',
                            '&:hover': { bgcolor: '#f3e8ff' },
                          }}
                        >
                          View Submissions ({m.submissions_count || 0})
                        </Button>
                      ) : <Box />}

                      <Button
                        size="small"
                        color="error"
                        onClick={() => handleDeleteMaterial(m.id)}
                        sx={{
                          borderRadius: '8px',
                          textTransform: 'none',
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          color: '#e11d48',
                          '&:hover': { bgcolor: '#fff1f2' },
                        }}
                      >
                        Delete
                      </Button>
                    </Box>
                  </Card>
                ))}
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Apply Leave Modal */}
      <Dialog
        open={leaveModalOpen}
        onClose={() => setLeaveModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '20px',
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
          <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', fontSize: '1rem' }}>
            Apply for Faculty Leave
          </Typography>
          <IconButton size="small" onClick={() => setLeaveModalOpen(false)} aria-label="close">
            <CloseIcon className="w-5 h-5" />
          </IconButton>
        </DialogTitle>

        <form onSubmit={handleApplyLeave}>
          <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {leaveError && <Alert severity="error" sx={{ borderRadius: '10px' }}>{leaveError}</Alert>}
            {leaveSuccess && <Alert severity="success" sx={{ borderRadius: '10px' }}>{leaveSuccess}</Alert>}

            <TextField
              label="Leave Date"
              type="date"
              required
              fullWidth
              size="small"
              value={leaveDate}
              onChange={(e) => setLeaveDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              InputProps={{ sx: { borderRadius: '10px' } }}
            />

            <TextField
              label="Reason for Absence"
              multiline
              rows={3}
              required
              fullWidth
              size="small"
              value={leaveReason}
              onChange={(e) => setLeaveReason(e.target.value)}
              placeholder="E.g., Academic conference attendance, medical leave..."
              InputProps={{ sx: { borderRadius: '10px' } }}
            />
          </DialogContent>

          <DialogActions sx={{ p: 2.5, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => setLeaveModalOpen(false)}
              sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, fontSize: '0.8rem' }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={submittingLeave}
              startIcon={submittingLeave ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, fontSize: '0.8rem', px: 2 }}
            >
              {submittingLeave ? 'Submitting...' : 'Submit Leave Request'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Create Material Modal */}
      <CreateMaterialModal
        isOpen={createMaterialModalOpen}
        onClose={() => setCreateMaterialModalOpen(false)}
        batches={facultyTaughtBatches.length > 0 ? facultyTaughtBatches : batches}
        subjects={facultyTaughtSubjects.length > 0 ? facultyTaughtSubjects : (user?.role === 'admin' ? subjects : [])}
        onCreated={loadMaterials}
      />

      {/* Submissions Inspection Modal */}
      <SubmissionsModal
        isOpen={submissionsModalOpen}
        onClose={() => {
          setSubmissionsModalOpen(false);
          setSelectedMaterialForSubs(null);
        }}
        material={selectedMaterialForSubs}
      />
    </Box>
  );
}