import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import CsvUploadModal from '../components/CsvUploadModal';
import EntityModal from '../components/EntityModal';
import { entitiesApi } from '../api/entities';
import {
  LightningIcon,
  TeacherIcon,
  RoomIcon,
  UsersIcon,
  BookIcon,
  BuildingIcon,
  CheckCircleIcon,
  UploadIcon,
  TrashIcon,
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
  TextField,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  AlertTitle,
  Snackbar,
} from '@mui/material';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    departments_count: 0,
    rooms_count: 0,
    faculty_count: 0,
    subjects_count: 0,
    batches_count: 0,
  });

  // Entity data states
  const [departments, setDepartments] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [batches, setBatches] = useState([]);
  const [electiveBands, setElectiveBands] = useState([]);

  // Modals
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [entityModalOpen, setEntityModalOpen] = useState(false);
  const [modalEntityType, setModalEntityType] = useState('departments');
  const [editingItem, setEditingItem] = useState(null);

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [sRes, dRes, rRes, fRes, subRes, bRes, ebRes] = await Promise.all([
        entitiesApi.getStats(),
        entitiesApi.getDepartments(),
        entitiesApi.getRooms(),
        entitiesApi.getFaculty(),
        entitiesApi.getSubjects(),
        entitiesApi.getBatches(),
        entitiesApi.getElectiveBands(),
      ]);
      setStats(sRes.data);
      setDepartments(dRes.data);
      setRooms(rRes.data);
      setFaculty(fRes.data);
      setSubjects(subRes.data);
      setBatches(bRes.data);
      setElectiveBands(ebRes.data);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleOpenAdd = (type) => {
    setModalEntityType(type);
    setEditingItem(null);
    setEntityModalOpen(true);
  };

  const handleOpenEdit = (type, item) => {
    setModalEntityType(type);
    setEditingItem(item);
    setEntityModalOpen(true);
  };

  const handleSaveEntity = async (formData) => {
    if (editingItem) {
      if (modalEntityType === 'departments') await entitiesApi.updateDepartment(editingItem.id, formData);
      else if (modalEntityType === 'rooms') await entitiesApi.updateRoom(editingItem.id, formData);
      else if (modalEntityType === 'faculty') await entitiesApi.updateFaculty(editingItem.id, formData);
      else if (modalEntityType === 'subjects') await entitiesApi.updateSubject(editingItem.id, formData);
      else if (modalEntityType === 'batches') await entitiesApi.updateBatch(editingItem.id, formData);
    } else {
      if (modalEntityType === 'departments') await entitiesApi.createDepartment(formData);
      else if (modalEntityType === 'rooms') await entitiesApi.createRoom(formData);
      else if (modalEntityType === 'faculty') await entitiesApi.createFaculty(formData);
      else if (modalEntityType === 'subjects') await entitiesApi.createSubject(formData);
      else if (modalEntityType === 'batches') await entitiesApi.createBatch(formData);
    }
    await fetchAllData();
  };

  // Clear Data states
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearTargetCategory, setClearTargetCategory] = useState('rooms');
  const [clearing, setClearing] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const categoryMeta = {
    rooms: {
      label: 'Rooms & Labs',
      singular: 'Room / Lab',
      addLabel: 'Room / Lab',
      count: rooms.length,
      description: 'Permanently remove all classroom and lab records along with any mapped timetable slots.'
    },
    faculty: {
      label: 'Faculty',
      singular: 'Faculty Member',
      addLabel: 'Faculty',
      count: faculty.length,
      description: 'Permanently remove all educator profiles, teaching qualifications, leaves, and schedule assignments.'
    },
    subjects: {
      label: 'Subjects',
      singular: 'Subject',
      addLabel: 'Subject',
      count: subjects.length,
      description: 'Permanently remove all academic courses, elective bands, and classroom curriculum mappings.'
    },
    batches: {
      label: 'Batches',
      singular: 'Batch Cohort',
      addLabel: 'Batch',
      count: batches.length,
      description: 'Permanently remove all student cohorts, sections, and associated timetable versions.'
    },
    departments: {
      label: 'Departments',
      singular: 'Department',
      addLabel: 'Department',
      count: departments.length,
      description: 'Permanently remove all academic departments and cascade reset all associated institutional data.'
    },
  };

  const handleOpenClearModal = (category) => {
    setClearTargetCategory(category);
    setClearModalOpen(true);
  };

  const handleConfirmClear = async () => {
    if (!clearTargetCategory) return;
    setClearing(true);
    try {
      const res = await entitiesApi.clearCategoryData(clearTargetCategory);
      setClearModalOpen(false);
      setSnackbar({
        open: true,
        message: res.data?.message || `Successfully cleared all ${categoryMeta[clearTargetCategory]?.label || clearTargetCategory} records.`,
        severity: 'success',
      });
      await fetchAllData();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || `Failed to clear ${clearTargetCategory} data.`,
        severity: 'error',
      });
    } finally {
      setClearing(false);
    }
  };

  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      if (type === 'departments') await entitiesApi.deleteDepartment(id);
      else if (type === 'rooms') await entitiesApi.deleteRoom(id);
      else if (type === 'faculty') await entitiesApi.deleteFaculty(id);
      else if (type === 'subjects') await entitiesApi.deleteSubject(id);
      else if (type === 'batches') await entitiesApi.deleteBatch(id);
      await fetchAllData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete record.');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#e0f2fe', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <Box component="main" sx={{ flex: 1, maxWidth: 1280, width: '100%', mx: 'auto', py: 4, px: { xs: 2, sm: 3, lg: 4 } }}>
        {/* Header with Title & Actions */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: 2,
            mb: 4,
          }}
        >
          <Box>
            <Chip
              label="Admin Central Control"
              size="small"
              sx={{
                bgcolor: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                fontWeight: 800,
                fontSize: '0.68rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                mb: 1,
              }}
            />
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em' }}>
              Institutional Resources & Data Hub
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem', mt: 0.25 }}>
              Configure academic departments, labs, smart classrooms, faculty workload thresholds, and NEP 2020 cohorts.
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Button
              component="a"
              href="/hod"
              variant="outlined"
              size="small"
              startIcon={<LightningIcon className="w-3.5 h-3.5" />}
              sx={{
                borderRadius: '10px',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.78rem',
                bgcolor: '#eff6ff',
                color: '#1d4ed8',
                borderColor: '#bfdbfe',
                '&:hover': { bgcolor: '#dbeafe' },
              }}
            >
              Solver & What-If Studio
            </Button>
            <Button
              variant="contained"
              color="primary"
              size="small"
              onClick={() => setUploadModalOpen(true)}
              startIcon={<UploadIcon className="w-4 h-4" />}
              sx={{
                borderRadius: '10px',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.78rem',
                boxShadow: '0 4px 12px rgba(29, 97, 242, 0.3)',
              }}
            >
              Bulk CSV / Excel Upload
            </Button>
          </Box>
        </Box>

        {/* Live Counters Grid */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' },
            gap: 2,
            mb: 4,
          }}
        >
          <Card variant="outlined" sx={{ borderRadius: '16px', p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, color: 'text.secondary', fontSize: '0.68rem' }}>
                Faculty
              </Typography>
              <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TeacherIcon className="w-4 h-4" />
              </Box>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary' }}>
              {stats.faculty_count}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
              Mapped educators
            </Typography>
          </Card>

          <Card variant="outlined" sx={{ borderRadius: '16px', p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, color: 'text.secondary', fontSize: '0.68rem' }}>
                Rooms & Labs
              </Typography>
              <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RoomIcon className="w-4 h-4" />
              </Box>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary' }}>
              {stats.rooms_count}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
              Smart & lab infra
            </Typography>
          </Card>

          <Card variant="outlined" sx={{ borderRadius: '16px', p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, color: 'text.secondary', fontSize: '0.68rem' }}>
                Batches
              </Typography>
              <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UsersIcon className="w-4 h-4" />
              </Box>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary' }}>
              {stats.batches_count}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
              Student sections
            </Typography>
          </Card>

          <Card variant="outlined" sx={{ borderRadius: '16px', p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, color: 'text.secondary', fontSize: '0.68rem' }}>
                Courses
              </Typography>
              <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookIcon className="w-4 h-4" />
              </Box>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary' }}>
              {stats.subjects_count}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
              Core + NEP electives
            </Typography>
          </Card>

          <Card variant="outlined" sx={{ borderRadius: '16px', p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, color: 'text.secondary', fontSize: '0.68rem' }}>
                Departments
              </Typography>
              <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BuildingIcon className="w-4 h-4" />
              </Box>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary' }}>
              {stats.departments_count}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
              Academic divisions
            </Typography>
          </Card>
        </Box>

        {/* Navigation Tabs Bar */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={(e, val) => {
              setActiveTab(val);
              setSearchTerm('');
            }}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                textTransform: 'capitalize',
                fontWeight: 700,
                fontSize: '0.82rem',
                minHeight: 44,
              },
            }}
          >
            <Tab value="overview" label="Overview & Workflow" />
            <Tab value="rooms" label="Rooms / Labs" />
            <Tab value="faculty" label="Faculty" />
            <Tab value="subjects" label="Subjects" />
            <Tab value="batches" label="Batches" />
            <Tab value="departments" label="Departments" />
          </Tabs>
        </Box>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
            <Paper elevation={0} sx={{ p: 3, borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircleIcon className="w-4 h-4" />
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary' }}>
                  Institutional Data Ingestion Status
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.78rem', mb: 2 }}>
                Verify curriculum parameters and infrastructure allocations before initiating the AI scheduling engine.
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid #f1f5f9' }}>
                  <Typography variant="body2" sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>Academic Departments</Typography>
                  <Chip label={departments.length} size="small" sx={{ fontWeight: 800, fontSize: '0.7rem', height: 20 }} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid #f1f5f9' }}>
                  <Typography variant="body2" sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>Classrooms & Laboratories</Typography>
                  <Chip label={rooms.length} size="small" sx={{ fontWeight: 800, fontSize: '0.7rem', height: 20 }} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid #f1f5f9' }}>
                  <Typography variant="body2" sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>Faculty Members Configured</Typography>
                  <Chip label={faculty.length} size="small" sx={{ fontWeight: 800, fontSize: '0.7rem', height: 20 }} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid #f1f5f9' }}>
                  <Typography variant="body2" sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>Subjects with NEP 2020 Elective Bands</Typography>
                  <Chip label={subjects.length} size="small" sx={{ fontWeight: 800, fontSize: '0.7rem', height: 20 }} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
                  <Typography variant="body2" sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>Student Cohorts / Batches</Typography>
                  <Chip label={batches.length} size="small" sx={{ fontWeight: 800, fontSize: '0.7rem', height: 20 }} />
                </Box>
              </Box>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: '20px',
                border: '1px solid #e2e8f0',
                bgcolor: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary' }}>
                  Quick Resource Actions
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.78rem', mt: 0.5 }}>
                  Instantly create and register institutional entities directly in the database.
                </Typography>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                <Button
                  variant="outlined"
                  onClick={() => handleOpenAdd('rooms')}
                  startIcon={<RoomIcon className="w-4 h-4 text-blue-600" />}
                  sx={{
                    justifyContent: 'flex-start',
                    py: 1.25,
                    px: 2,
                    borderRadius: '12px',
                    borderColor: '#e2e8f0',
                    color: '#1e293b',
                    bgcolor: '#f8fafc',
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    '&:hover': { bgcolor: '#eff6ff', borderColor: '#bfdbfe' },
                  }}
                >
                  + Add Room / Lab
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => handleOpenAdd('faculty')}
                  startIcon={<TeacherIcon className="w-4 h-4 text-indigo-600" />}
                  sx={{
                    justifyContent: 'flex-start',
                    py: 1.25,
                    px: 2,
                    borderRadius: '12px',
                    borderColor: '#e2e8f0',
                    color: '#1e293b',
                    bgcolor: '#f8fafc',
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    '&:hover': { bgcolor: '#eef2ff', borderColor: '#c7d2fe' },
                  }}
                >
                  + Add Faculty
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => handleOpenAdd('subjects')}
                  startIcon={<BookIcon className="w-4 h-4 text-emerald-600" />}
                  sx={{
                    justifyContent: 'flex-start',
                    py: 1.25,
                    px: 2,
                    borderRadius: '12px',
                    borderColor: '#e2e8f0',
                    color: '#1e293b',
                    bgcolor: '#f8fafc',
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    '&:hover': { bgcolor: '#ecfdf5', borderColor: '#a7f3d0' },
                  }}
                >
                  + Add Subject
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => handleOpenAdd('batches')}
                  startIcon={<UsersIcon className="w-4 h-4 text-purple-600" />}
                  sx={{
                    justifyContent: 'flex-start',
                    py: 1.25,
                    px: 2,
                    borderRadius: '12px',
                    borderColor: '#e2e8f0',
                    color: '#1e293b',
                    bgcolor: '#f8fafc',
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    '&:hover': { bgcolor: '#faf5ff', borderColor: '#e9d5ff' },
                  }}
                >
                  + Add Batch
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => handleOpenAdd('departments')}
                  startIcon={<BuildingIcon className="w-4 h-4 text-amber-600" />}
                  sx={{
                    gridColumn: { sm: 'span 2' },
                    justifyContent: 'flex-start',
                    py: 1.25,
                    px: 2,
                    borderRadius: '12px',
                    borderColor: '#e2e8f0',
                    color: '#1e293b',
                    bgcolor: '#f8fafc',
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    '&:hover': { bgcolor: '#fffbeb', borderColor: '#fde68a' },
                  }}
                >
                  + Add Department
                </Button>
              </Box>
            </Paper>
          </Box>
        )}

        {/* Entity Tables */}
        {activeTab !== 'overview' && (
          <Paper elevation={0} sx={{ p: 3, borderRadius: '20px', border: '1px solid #e2e8f0' }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 3 }}>
              <TextField
                size="small"
                placeholder={`Search ${activeTab}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ width: { xs: '100%', sm: 300 }, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
              />
              <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={() => handleOpenAdd(activeTab)}
                sx={{
                  borderRadius: '10px',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  boxShadow: '0 4px 12px rgba(29, 97, 242, 0.3)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  px: 2,
                }}
              >
                + Add {categoryMeta[activeTab]?.addLabel || categoryMeta[activeTab]?.singular || activeTab}
              </Button>
            </Box>

            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: '12px' }}>
              {activeTab === 'departments' && (
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', py: 1.5 }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', py: 1.5 }}>Shift</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.75rem', py: 1.5 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {departments
                      .filter((d) => d.name.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((d) => (
                        <TableRow key={d.id} hover>
                          <TableCell sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.8rem' }}>{d.name}</TableCell>
                          <TableCell sx={{ textTransform: 'capitalize' }}>
                            <Chip label={d.shift} size="small" sx={{ fontWeight: 700, fontSize: '0.68rem', height: 20 }} />
                          </TableCell>
                          <TableCell align="right">
                            <Button size="small" onClick={() => handleOpenEdit('departments', d)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.72rem' }}>
                              Edit
                            </Button>
                            <Button size="small" color="error" onClick={() => handleDelete('departments', d.id)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.72rem' }}>
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}

              {activeTab === 'rooms' && (
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', py: 1.5 }}>Room Name</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', py: 1.5 }}>Capacity</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', py: 1.5 }}>Type</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', py: 1.5 }}>Department</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.75rem', py: 1.5 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rooms
                      .filter((r) => r.name.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((r) => (
                        <TableRow key={r.id} hover>
                          <TableCell sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.8rem' }}>{r.name}</TableCell>
                          <TableCell sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>{r.capacity} seats</TableCell>
                          <TableCell>
                            <Chip
                              label={r.is_lab ? 'Computer / Tech Lab' : 'Smart Lecture Hall'}
                              size="small"
                              sx={{
                                bgcolor: r.is_lab ? '#eff6ff' : '#f8fafc',
                                color: r.is_lab ? '#1d4ed8' : '#334155',
                                fontWeight: 700,
                                fontSize: '0.65rem',
                                height: 20,
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>{r.department_name || 'Shared Campus'}</TableCell>
                          <TableCell align="right">
                            <Button size="small" onClick={() => handleOpenEdit('rooms', r)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.72rem' }}>
                              Edit
                            </Button>
                            <Button size="small" color="error" onClick={() => handleDelete('rooms', r.id)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.72rem' }}>
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}

              {activeTab === 'faculty' && (
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', py: 1.5 }}>Faculty Member</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', py: 1.5 }}>Department</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', py: 1.5 }}>Workload Norms</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', py: 1.5 }}>Competencies</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.75rem', py: 1.5 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {faculty
                      .filter((f) => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((f) => (
                        <TableRow key={f.id} hover>
                          <TableCell sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.8rem' }}>{f.name}</TableCell>
                          <TableCell sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>{f.department_name || '—'}</TableCell>
                          <TableCell sx={{ color: 'text.secondary', fontSize: '0.78rem', fontWeight: 600 }}>
                            {f.max_classes_per_day} / day · {f.max_classes_per_week} / wk
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: 300 }}>
                              {f.subjects?.length > 0 ? (
                                f.subjects.map((s) => (
                                  <Chip
                                    key={s.id}
                                    label={s.name}
                                    size="small"
                                    sx={{
                                      bgcolor: '#eff6ff',
                                      color: '#1d4ed8',
                                      fontSize: '0.65rem',
                                      height: 18,
                                    }}
                                  />
                                ))
                              ) : (
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                                  None assigned
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Button size="small" onClick={() => handleOpenEdit('faculty', f)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.72rem' }}>
                              Edit
                            </Button>
                            <Button size="small" color="error" onClick={() => handleDelete('faculty', f.id)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.72rem' }}>
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}

              {activeTab === 'subjects' && (
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', py: 1.5 }}>Course Name</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', py: 1.5 }}>Department</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', py: 1.5 }}>Semester</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', py: 1.5 }}>Sessions / Wk</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', py: 1.5 }}>Category</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.75rem', py: 1.5 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {subjects
                      .filter((s) => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((s) => (
                        <TableRow key={s.id} hover>
                          <TableCell sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.8rem' }}>{s.name}</TableCell>
                          <TableCell sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>{s.department_name || '—'}</TableCell>
                          <TableCell sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>Sem {s.semester}</TableCell>
                          <TableCell sx={{ color: 'text.primary', fontWeight: 700, fontSize: '0.78rem' }}>{s.sessions_per_week} classes</TableCell>
                          <TableCell>
                            {s.is_lab && <Chip label="Lab Practice" size="small" sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: '0.65rem', height: 20, mr: 0.5 }} />}
                            {s.is_elective && (
                              <Chip
                                label={`NEP Elective: ${s.elective_band_name || 'Band'}`}
                                size="small"
                                sx={{ bgcolor: '#fffbeb', color: '#b45309', fontWeight: 700, fontSize: '0.65rem', height: 20 }}
                              />
                            )}
                            {!s.is_lab && !s.is_elective && (
                              <Chip label="Core Theory" size="small" sx={{ bgcolor: '#f8fafc', color: '#475569', fontWeight: 700, fontSize: '0.65rem', height: 20 }} />
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Button size="small" onClick={() => handleOpenEdit('subjects', s)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.72rem' }}>
                              Edit
                            </Button>
                            <Button size="small" color="error" onClick={() => handleDelete('subjects', s.id)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.72rem' }}>
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}

              {activeTab === 'batches' && (
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', py: 1.5 }}>Batch Cohort</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', py: 1.5 }}>Department</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', py: 1.5 }}>Semester</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', py: 1.5 }}>Shift</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', py: 1.5 }}>Strength</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.75rem', py: 1.5 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {batches
                      .filter((b) => b.name.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((b) => (
                        <TableRow key={b.id} hover>
                          <TableCell sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.8rem' }}>{b.name}</TableCell>
                          <TableCell sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>{b.department_name || '—'}</TableCell>
                          <TableCell sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>Sem {b.semester}</TableCell>
                          <TableCell sx={{ textTransform: 'capitalize' }}>
                            <Chip label={b.shift} size="small" sx={{ fontWeight: 700, fontSize: '0.68rem', height: 20 }} />
                          </TableCell>
                          <TableCell sx={{ color: 'text.primary', fontWeight: 700, fontSize: '0.78rem' }}>{b.strength} students</TableCell>
                          <TableCell align="right">
                            <Button size="small" onClick={() => handleOpenEdit('batches', b)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.72rem' }}>
                              Edit
                            </Button>
                            <Button size="small" color="error" onClick={() => handleDelete('batches', b.id)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.72rem' }}>
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </TableContainer>

            {/* Danger Zone: Category Clear Data Footer */}
            <Box
              sx={{
                mt: 3.5,
                p: { xs: 2, sm: 2.5 },
                borderRadius: '14px',
                border: '1px solid #fee2e2',
                bgcolor: '#fff5f5',
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between',
                alignItems: { xs: 'flex-start', sm: 'center' },
                gap: 2,
              }}
            >
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Chip
                    label="Danger Zone"
                    size="small"
                    sx={{
                      bgcolor: '#fecaca',
                      color: '#991b1b',
                      fontWeight: 800,
                      fontSize: '0.65rem',
                      height: 18,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#991b1b', fontSize: '0.88rem' }}>
                    Reset {categoryMeta[activeTab]?.label || activeTab} Data
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: '#7f1d1d', fontSize: '0.78rem' }}>
                  {categoryMeta[activeTab]?.description || `Permanently delete all ${activeTab} records.`}
                </Typography>
              </Box>

              <Button
                variant="contained"
                color="error"
                size="small"
                disabled={clearing || (categoryMeta[activeTab]?.count || 0) === 0}
                onClick={() => handleOpenClearModal(activeTab)}
                startIcon={<TrashIcon className="w-4 h-4" />}
                sx={{
                  borderRadius: '10px',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  py: 1,
                  px: 2,
                  bgcolor: '#dc2626',
                  boxShadow: '0 2px 10px rgba(220, 38, 38, 0.25)',
                  '&:hover': { bgcolor: '#b91c1c' },
                  whiteSpace: 'nowrap',
                  alignSelf: { xs: 'stretch', sm: 'auto' },
                }}
              >
                Clear All {categoryMeta[activeTab]?.label || activeTab} Data ({categoryMeta[activeTab]?.count || 0})
              </Button>
            </Box>
          </Paper>
        )}
      </Box>

      {/* Modals */}
      <CsvUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={fetchAllData}
      />

      <EntityModal
        isOpen={entityModalOpen}
        onClose={() => setEntityModalOpen(false)}
        onSave={handleSaveEntity}
        entityType={modalEntityType}
        initialData={editingItem}
        extraOptions={{ departments, subjects, electiveBands }}
      />

      {/* Clear Category Confirmation Dialog */}
      <Dialog
        open={clearModalOpen}
        onClose={() => !clearing && setClearModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '20px',
            p: 1,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.1rem', color: '#991b1b', pb: 1 }}>
          Clear All {categoryMeta[clearTargetCategory]?.label || clearTargetCategory} Data?
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Alert severity="error" sx={{ mb: 2, borderRadius: '12px', fontSize: '0.8rem' }}>
            <AlertTitle sx={{ fontWeight: 800, fontSize: '0.85rem' }}>Permanent Deletion Warning</AlertTitle>
            This action will permanently delete all <strong>{categoryMeta[clearTargetCategory]?.count || 0}</strong> {categoryMeta[clearTargetCategory]?.label?.toLowerCase() || clearTargetCategory} records from the database.
            <br /><br />
            Any mapped timetable slots, classroom materials, and dependent constraints will also be reset. <strong>This action cannot be undone.</strong>
          </Alert>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
            Are you sure you want to proceed with clearing this category?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 0, gap: 1 }}>
          <Button
            onClick={() => setClearModalOpen(false)}
            disabled={clearing}
            variant="outlined"
            size="small"
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmClear}
            disabled={clearing}
            variant="contained"
            color="error"
            size="small"
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 700,
              bgcolor: '#dc2626',
              '&:hover': { bgcolor: '#b91c1c' },
              minWidth: 140,
            }}
          >
            {clearing ? (
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} thickness={4.5} sx={{ color: '#ffffff' }} />
                <span>Clearing...</span>
              </Box>
            ) : (
              `Yes, Clear All Data`
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Action Feedback Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%', borderRadius: '12px', fontWeight: 600, fontSize: '0.85rem' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
