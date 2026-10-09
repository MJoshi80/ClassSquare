import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import TimetableGrid from '../components/TimetableGrid';
import TimetableSyncExportMenu from '../components/TimetableSyncExportMenu';
import WhatIfSlotModal from '../components/WhatIfSlotModal';
import ApprovalModal from '../components/ApprovalModal';
import SubstituteModal from '../components/SubstituteModal';
import { timetableApi } from '../api/timetable';
import { votingApi } from '../api/voting';
import { entitiesApi } from '../api/entities';
import { leaveApi } from '../api/leave';
import { exportApi } from '../api/export';
import {
  LightningIcon,
  UsersIcon,
  AlertTriangleIcon,
  CheckIcon,
  SpreadsheetIcon,
  FileTextIcon,
  CalendarIcon,
  PrinterIcon,
  InfoIcon,
  UserCheckIcon,
  SparkleIcon,
} from '../components/Icons';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Button,
  ButtonGroup,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  AlertTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';

export default function HodDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(['studio', 'leaves'].includes(urlTab) ? urlTab : 'studio');

  useEffect(() => {
    const currentTab = searchParams.get('tab');
    if (currentTab && ['studio', 'leaves'].includes(currentTab)) {
      setActiveTab(currentTab);
    }
  }, [searchParams]);

  // Timetable Generator & Studio State
  const [departments, setDepartments] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedSemester, setSelectedSemester] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [genResponse, setGenResponse] = useState(null);
  const [activeOptionIdx, setActiveOptionIdx] = useState(0);
  const [votingSlate, setVotingSlate] = useState(null);

  const [rooms, setRooms] = useState([]);
  const [faculty, setFaculty] = useState([]);

  // Timetable Modals
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [whatIfModalOpen, setWhatIfModalOpen] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalAction, setApprovalAction] = useState('approve');

  // Existing approved/published versions
  const [existingVersions, setExistingVersions] = useState([]);

  // Leave & Substitution State
  const [leaves, setLeaves] = useState([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [selectedLeaveForSub, setSelectedLeaveForSub] = useState(null);
  const [substituteModalOpen, setSubstituteModalOpen] = useState(false);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState('all');
  const [leaveActionLoading, setLeaveActionLoading] = useState(null);

  useEffect(() => {
    const initData = async () => {
      try {
        const [dRes, rRes, fRes] = await Promise.all([
          entitiesApi.getDepartments(),
          entitiesApi.getRooms(),
          entitiesApi.getFaculty(),
        ]);
        setDepartments(dRes.data);
        if (dRes.data.length > 0) {
          setSelectedDeptId(dRes.data[0].id);
        }
        setRooms(rRes.data);
        setFaculty(fRes.data);
      } catch (err) {
        console.error('Failed to load initial data', err);
      }
    };
    initData();
  }, []);

  const fetchVotingSlate = async () => {
    if (!selectedDeptId || !selectedSemester) return;
    try {
      const vRes = await votingApi.getSlate(Number(selectedDeptId), Number(selectedSemester));
      setVotingSlate(vRes.data);
    } catch (err) {
      console.error('Failed to load voting slate', err);
      setVotingSlate(null);
    }
  };

  const loadVersions = async () => {
    if (!selectedDeptId) return;
    try {
      const res = await timetableApi.getVersions(Number(selectedDeptId), Number(selectedSemester));
      const versions = res.data || [];
      setExistingVersions(versions);
      if (versions.length > 0) {
        // Group candidate options by option_rank, taking the latest version of each
        const rankMap = new Map();
        for (const v of versions) {
          const rank = v.option_rank || 1;
          if (!rankMap.has(rank)) {
            rankMap.set(rank, v);
          }
        }
        const deduped = Array.from(rankMap.values())
          .filter((v) => (v.option_rank || 1) <= 3)
          .sort((a, b) => (a.option_rank || 1) - (b.option_rank || 1))
          .slice(0, 3);
        setGenResponse({ status: 'SUCCESS', options: deduped });
        setActiveOptionIdx(0);
      } else {
        setGenResponse(null);
      }
      fetchVotingSlate();
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadVersions();
    fetchVotingSlate();
  }, [selectedDeptId, selectedSemester]);

  const loadLeaves = async () => {
    setLeavesLoading(true);
    try {
      const res = await leaveApi.getLeaves();
      setLeaves(res.data);
    } catch (err) {
      console.error('Failed to load leaves', err);
    } finally {
      setLeavesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'leaves') {
      loadLeaves();
    }
  }, [activeTab]);

  const handleGenerate = async () => {
    if (!selectedDeptId) return;
    setGenerating(true);
    setGenResponse(null);
    try {
      const res = await timetableApi.generate(Number(selectedDeptId), Number(selectedSemester));
      setGenResponse(res.data);
      setActiveOptionIdx(0);
      loadVersions();
      fetchVotingSlate();
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleSlotClick = (slot) => {
    setSelectedSlot(slot);
    setWhatIfModalOpen(true);
  };

  const currentOption = genResponse?.options?.[activeOptionIdx] || null;

  const handleReloadCurrentVersion = async () => {
    if (!currentOption) return;
    try {
      const res = await timetableApi.getTimetable(currentOption.id);
      setGenResponse((prev) => {
        if (!prev) return prev;
        const nextOpts = [...prev.options];
        nextOpts[activeOptionIdx] = res.data;
        return { ...prev, options: nextOpts };
      });
      loadVersions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleApprovalConfirm = async (comment) => {
    if (!currentOption) return;
    if (approvalAction === 'approve') {
      await timetableApi.approve(currentOption.id, comment);
    } else {
      await timetableApi.reject(currentOption.id, comment);
    }
    await handleReloadCurrentVersion();
    await fetchVotingSlate();
  };

  const handleApproveLeave = async (leaveId) => {
    setLeaveActionLoading(leaveId);
    try {
      await leaveApi.approveLeave(leaveId);
      await loadLeaves();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to approve leave');
    } finally {
      setLeaveActionLoading(null);
    }
  };

  const handleRejectLeave = async (leaveId) => {
    setLeaveActionLoading(leaveId);
    try {
      await leaveApi.rejectLeave(leaveId);
      await loadLeaves();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to reject leave');
    } finally {
      setLeaveActionLoading(null);
    }
  };

  const handleOpenSubstituteModal = (leave) => {
    setSelectedLeaveForSub(leave);
    setSubstituteModalOpen(true);
  };

  const statusBadge = (status) => {
    if (status === 'approved') return { bgcolor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' };
    if (status === 'substituted') return { bgcolor: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff' };
    if (status === 'rejected') return { bgcolor: '#fff1f2', color: '#9f1239', border: '1px solid #fecdd3' };
    return { bgcolor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' };
  };

  const pendingLeavesCount = leaves.filter((l) => l.status === 'pending' || l.status === 'substituted').length;

  const filteredLeaves = leaves.filter((l) => {
    if (leaveStatusFilter === 'all') return true;
    return l.status === leaveStatusFilter;
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
              HOD Command Center
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', mt: 0.25 }}>
              AI Timetable Generation, Real-Time What-If Sandbox & Automated Leave-Substitution Dispatch.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label="Google OR-Tools CP-SAT Active"
              size="small"
              sx={{
                bgcolor: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                fontWeight: 800,
                fontSize: '0.72rem',
                height: 26,
              }}
            />
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
              value="studio"
              icon={<CalendarIcon className="w-4 h-4" />}
              iconPosition="start"
              label="Timetable & What-If Studio"
            />
            <Tab
              value="leaves"
              icon={<UsersIcon className="w-4 h-4" />}
              iconPosition="start"
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>Leave & Substitution Hub</span>
                  {pendingLeavesCount > 0 && (
                    <Chip
                      label={pendingLeavesCount}
                      size="small"
                      sx={{
                        bgcolor: '#f59e0b',
                        color: '#ffffff',
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

        {/* Tab 1: Studio & Timetable Generator */}
        {activeTab === 'studio' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Generator Filter Bar */}
            <Paper
              elevation={0}
              className="no-print"
              sx={{
                p: 2.5,
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
              }}
            >
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr 2fr' },
                  gap: 2,
                  alignItems: 'center',
                }}
              >
                <FormControl fullWidth size="small">
                  <InputLabel id="dept-select">Department</InputLabel>
                  <Select
                    labelId="dept-select"
                    value={selectedDeptId}
                    label="Department"
                    onChange={(e) => setSelectedDeptId(e.target.value)}
                    sx={{ borderRadius: '10px' }}
                  >
                    {departments.map((d) => (
                      <MenuItem key={d.id} value={d.id}>
                        {d.name} ({d.shift})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth size="small">
                  <InputLabel id="sem-select">Semester Cohort</InputLabel>
                  <Select
                    labelId="sem-select"
                    value={selectedSemester}
                    label="Semester Cohort"
                    onChange={(e) => setSelectedSemester(e.target.value)}
                    sx={{ borderRadius: '10px' }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <MenuItem key={s} value={s}>
                        Semester {s}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Button
                  variant="contained"
                  onClick={handleGenerate}
                  disabled={generating || !selectedDeptId}
                  sx={{
                    borderRadius: '10px',
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    py: 1,
                    px: 2.5,
                    minWidth: 200,
                    color: '#ffffff',
                    background: generating
                      ? 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)'
                      : 'linear-gradient(135deg, #1d61f2 0%, #2563eb 50%, #3b82f6 100%)',
                    boxShadow: '0 4px 14px rgba(29, 97, 242, 0.35)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #184cc2 0%, #1d4ed8 50%, #2563eb 100%)',
                      boxShadow: '0 6px 18px rgba(29, 97, 242, 0.45)',
                    },
                    '&.Mui-disabled': {
                      background: generating
                        ? 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%) !important'
                        : '#e2e8f0 !important',
                      color: generating ? '#ffffff !important' : '#94a3b8 !important',
                      boxShadow: generating ? '0 4px 14px rgba(29, 97, 242, 0.35)' : 'none',
                      cursor: generating ? 'wait' : 'not-allowed',
                      pointerEvents: generating ? 'none' : undefined,
                    },
                  }}
                >
                  {generating ? (
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      <CircularProgress
                        size={18}
                        thickness={4.5}
                        sx={{
                          color: '#ffffff',
                          display: 'inline-block',
                          verticalAlign: 'middle',
                          flexShrink: 0,
                        }}
                      />
                      <span>Solving Constraints...</span>
                    </Box>
                  ) : (
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      <LightningIcon className="w-4 h-4 flex-shrink-0" />
                      <span>Generate AI Timetable</span>
                    </Box>
                  )}
                </Button>
              </Box>
            </Paper>

            {/* Diagnostic Alert on INFEASIBLE */}
            {genResponse && genResponse.status === 'INFEASIBLE' && (
              <Alert
                severity="warning"
                icon={<SparkleIcon className="w-5 h-5 text-amber-500" />}
                sx={{ borderRadius: '16px' }}
              >
                <AlertTitle sx={{ fontWeight: 800 }}>Solver Diagnostic & Rearrangement Suggestions</AlertTitle>
                <Typography variant="body2" sx={{ fontSize: '0.8rem', mb: 1 }}>
                  The constraint solver could not find a valid schedule with current constraints. Recommended adjustments:
                </Typography>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.78rem' }}>
                  {genResponse.diagnostic_suggestions?.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </Alert>
            )}

            {/* Main Content Area: Multi-Option Compare & Sandbox Grid */}
            {genResponse && genResponse.status === 'SUCCESS' && genResponse.options.length > 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Multi-Option Switcher and Action Bar */}
                <Paper
                  elevation={0}
                  className="no-print"
                  sx={{
                    p: 2.5,
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  {/* Top Tier: Solutions Switcher & Status Badges */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                      <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, color: 'text.secondary', mr: 0.5 }}>
                        Solutions:
                      </Typography>
                      {genResponse.options.slice(0, 3).map((opt, idx) => {
                        const voteInfo = votingSlate?.options?.find((o) => o.id === opt.id);
                        const isSelected = activeOptionIdx === idx;
                        const voteCount = voteInfo?.vote_count || 0;
                        const votePct = Math.round(voteInfo?.vote_percentage || 0);
                        return (
                          <Button
                            key={opt.id}
                            variant={isSelected ? 'contained' : 'outlined'}
                            color={isSelected ? 'primary' : 'inherit'}
                            onClick={() => setActiveOptionIdx(idx)}
                            sx={{
                              borderRadius: '10px',
                              textTransform: 'none',
                              fontWeight: 700,
                              fontSize: '0.78rem',
                              py: 0.6,
                              px: 1.5,
                              borderColor: isSelected ? 'primary.main' : '#cbd5e1',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <span>Option {opt.option_rank || idx + 1}</span>
                            <Chip
                              icon={<UsersIcon className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-blue-600'}`} />}
                              label={`${voteCount} ${voteCount === 1 ? 'vote' : 'votes'}${voteCount > 0 ? ` (${votePct}%)` : ''}`}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                bgcolor: isSelected ? 'rgba(255,255,255,0.2)' : '#eff6ff',
                                color: isSelected ? '#ffffff' : '#1d4ed8',
                                border: isSelected ? '1px solid rgba(255,255,255,0.3)' : '1px solid #bfdbfe',
                              }}
                            />
                          </Button>
                        );
                      })}
                    </Box>

                    {currentOption && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={currentOption.status}
                          size="small"
                          sx={{
                            ...statusBadge(currentOption.status),
                            fontWeight: 800,
                            fontSize: '0.7rem',
                            textTransform: 'capitalize',
                            height: 24,
                          }}
                        />
                        <Chip
                          icon={<CheckIcon className="w-3 h-3 text-emerald-600" />}
                          label="0 Clashes"
                          size="small"
                          sx={{
                            bgcolor: '#ecfdf5',
                            color: '#065f46',
                            border: '1px solid #a7f3d0',
                            fontWeight: 800,
                            fontSize: '0.7rem',
                            height: 24,
                          }}
                        />
                      </Box>
                    )}
                  </Box>

                  {/* Bottom Tier: Candidate Meta & Approval Actions */}
                  {currentOption && (
                    <Box
                      sx={{
                        pt: 1.5,
                        borderTop: '1px solid #f1f5f9',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 1.5,
                      }}
                    >
                      {/* Candidate Meta Info */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                        <Typography variant="caption" sx={{ color: '#0f172a', fontWeight: 800, fontSize: '0.82rem' }}>
                          Option {currentOption.option_rank || activeOptionIdx + 1}: {currentOption.optimization_focus || 'Balanced Academic Schedule'}
                        </Typography>
                        {(() => {
                          const currentVoteInfo = votingSlate?.options?.find((o) => o.id === currentOption.id);
                          const currentVoteCount = currentVoteInfo?.vote_count || 0;
                          const currentVotePct = Math.round(currentVoteInfo?.vote_percentage || 0);
                          return (
                            <Chip
                              icon={<UsersIcon className="w-3.5 h-3.5 text-blue-600" />}
                              label={`${currentVoteCount} Student Vote${currentVoteCount === 1 ? '' : 's'}${currentVoteCount > 0 ? ` (${currentVotePct}%)` : ''}`}
                              size="small"
                              sx={{
                                bgcolor: '#eff6ff',
                                color: '#1e40af',
                                border: '1px solid #bfdbfe',
                                fontWeight: 800,
                                fontSize: '0.72rem',
                                height: 24,
                              }}
                            />
                          );
                        })()}
                        <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                          • {currentOption.total_slots || currentOption.slots?.length || 0} active periods
                        </Typography>
                      </Box>

                      {/* Approval Actions */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          onClick={() => {
                            setApprovalAction('reject');
                            setApprovalModalOpen(true);
                          }}
                          sx={{
                            borderRadius: '8px',
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            borderColor: '#fecdd3',
                            bgcolor: '#fff1f2',
                            color: '#e11d48',
                            '&:hover': { bgcolor: '#ffe4e6' },
                          }}
                        >
                          Reject
                        </Button>

                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => {
                            setApprovalAction('approve');
                            setApprovalModalOpen(true);
                          }}
                          sx={{
                            borderRadius: '8px',
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            bgcolor: '#16a34a',
                            color: '#ffffff',
                            boxShadow: '0 2px 8px rgba(22, 163, 74, 0.25)',
                            '&:hover': { bgcolor: '#15803d' },
                          }}
                        >
                          Approve & Publish
                        </Button>
                      </Box>
                    </Box>
                  )}

                  {/* Constraint Optimization Profile Card */}
                  {currentOption && (
                    <Box
                      sx={{
                        pt: 1.5,
                        borderTop: '1px solid #f1f5f9',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1.5,
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e293b', fontSize: '0.82rem' }}>
                            Constraint Optimization Profile & Trade-offs
                          </Typography>
                          <Chip
                            label={currentOption.optimization_focus || `Option ${currentOption.option_rank || activeOptionIdx + 1} Profile`}
                            size="small"
                            sx={{
                              bgcolor: '#f8fafc',
                              color: '#334155',
                              border: '1px solid #e2e8f0',
                              fontWeight: 700,
                              fontSize: '0.68rem',
                              height: 22,
                            }}
                          />
                        </Box>
                        <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                          {currentOption.tagline || 'Evaluated against zero-clash hard constraints and soft continuous scheduling norms.'}
                        </Typography>
                      </Box>

                      {/* 3 Constraint Highlight Cards */}
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                          gap: 1.5,
                        }}
                      >
                        {(currentOption.top_optimized_constraints || [
                          {
                            name: 'Student Schedule Continuity',
                            metric: '94% Continuity',
                            badge: 'High Efficiency',
                            description: 'Minimized empty waiting hours between lectures on campus.'
                          },
                          {
                            name: 'Faculty Workload Equity',
                            metric: '92% Compactness',
                            badge: 'Balanced Teaching',
                            description: 'Even distribution of teaching hours and consolidated lecture blocks.'
                          },
                          {
                            name: 'Resource & Lab Efficiency',
                            metric: '98% Alignment',
                            badge: 'Optimal Matching',
                            description: 'Optimal cohort room capacity matching with zero room double-booking.'
                          }
                        ]).map((item, cIdx) => (
                          <Paper
                            key={cIdx}
                            elevation={0}
                            sx={{
                              p: 1.75,
                              borderRadius: '12px',
                              bgcolor: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 0.75,
                            }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="caption" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.78rem' }}>
                                {item.name}
                              </Typography>
                              <Chip
                                label={item.badge || item.metric}
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
                            </Box>
                            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.73rem', lineHeight: 1.45 }}>
                              {item.description}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 'auto', pt: 0.5 }}>
                              <Typography variant="caption" sx={{ color: '#475569', fontWeight: 700, fontSize: '0.7rem' }}>
                                Metric:
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#1d4ed8', fontWeight: 800, fontSize: '0.72rem' }}>
                                {item.metric}
                              </Typography>
                            </Box>
                          </Paper>
                        ))}
                      </Box>
                    </Box>
                  )}
                </Paper>



                {/* Sandbox Grid */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: '20px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary' }}>
                      Option {currentOption.option_rank} Schedule Matrix
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Chip
                        icon={<InfoIcon className="w-3.5 h-3.5 text-blue-600" />}
                        label="Tip: Click any slot below to open What-If Sandbox"
                        size="small"
                        sx={{
                          bgcolor: '#eff6ff',
                          color: '#1d4ed8',
                          border: '1px solid #bfdbfe',
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          height: 24,
                        }}
                      />
                      <TimetableSyncExportMenu
                        scheduleTitle={`Option ${currentOption.option_rank} Schedule Matrix`}
                        onSyncIcal={() => exportApi.downloadTimetableIcal(currentOption.id)}
                        onExportExcel={() => exportApi.downloadTimetableExcel(currentOption.id)}
                        onExportCsv={() => exportApi.downloadTimetableCsv(currentOption.id)}
                        onPrint={() => window.print()}
                      />
                    </Box>
                  </Box>

                  <TimetableGrid
                    slots={currentOption.slots}
                    onSlotClick={handleSlotClick}
                    readonly={false}
                  />
                </Paper>
              </Box>
            )}
          </Box>
        )}

        {/* Tab 2: Leaves & Substitution Hub */}
        {activeTab === 'leaves' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between',
                alignItems: { xs: 'flex-start', sm: 'center' },
                gap: 2,
              }}
            >
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary' }}>
                  Faculty Leave Requests & Substitution Queue
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.78rem', mt: 0.25 }}>
                  Review faculty absences, evaluate eligible substitute faculty based on department & workload, and reassign classes with one click.
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel id="leave-filter-label">Filter</InputLabel>
                  <Select
                    labelId="leave-filter-label"
                    value={leaveStatusFilter}
                    label="Filter"
                    onChange={(e) => setLeaveStatusFilter(e.target.value)}
                    sx={{ borderRadius: '10px', fontSize: '0.78rem' }}
                  >
                    <MenuItem value="all">All Leaves ({leaves.length})</MenuItem>
                    <MenuItem value="pending">Pending ({leaves.filter((l) => l.status === 'pending').length})</MenuItem>
                    <MenuItem value="substituted">Substituted ({leaves.filter((l) => l.status === 'substituted').length})</MenuItem>
                    <MenuItem value="approved">Approved ({leaves.filter((l) => l.status === 'approved').length})</MenuItem>
                    <MenuItem value="rejected">Rejected ({leaves.filter((l) => l.status === 'rejected').length})</MenuItem>
                  </Select>
                </FormControl>

                <Button
                  size="small"
                  variant="outlined"
                  onClick={loadLeaves}
                  sx={{
                    borderRadius: '10px',
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    color: '#475569',
                    borderColor: '#cbd5e1',
                  }}
                >
                  Refresh
                </Button>
              </Box>
            </Paper>

            {/* Leaves List Table */}
            <TableContainer
              component={Paper}
              elevation={0}
              sx={{
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                overflow: 'hidden',
              }}
            >
              {leavesLoading ? (
                <Box sx={{ py: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <CircularProgress size={28} />
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Loading leave requests...</Typography>
                </Box>
              ) : filteredLeaves.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontStyle: 'italic', fontSize: '0.85rem' }}>
                  No leave requests found matching this filter.
                </Box>
              ) : (
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.78rem', py: 1.5 }}>Faculty Member</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.78rem', py: 1.5 }}>Date of Absence</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.78rem', py: 1.5 }}>Impact</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.78rem', py: 1.5 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.78rem', py: 1.5 }}>Substitute</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.78rem', py: 1.5 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredLeaves.map((l) => (
                      <TableRow key={l.id} hover>
                        <TableCell sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.82rem' }}>
                          {l.faculty_name}
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>
                          {l.date}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={`${l.affected_slots_count} periods`}
                            size="small"
                            sx={{
                              bgcolor: '#eff6ff',
                              color: '#1d4ed8',
                              fontWeight: 700,
                              fontSize: '0.68rem',
                              height: 20,
                            }}
                          />
                        </TableCell>
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
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                            {l.status !== 'rejected' && (
                              <Button
                                size="small"
                                variant="contained"
                                color="primary"
                                onClick={() => handleOpenSubstituteModal(l)}
                                sx={{
                                  borderRadius: '8px',
                                  textTransform: 'none',
                                  fontWeight: 700,
                                  fontSize: '0.7rem',
                                  py: 0.5,
                                  px: 1.5,
                                }}
                              >
                                {l.substitute_name ? 'Change Substitute' : 'Find Best Substitute'}
                              </Button>
                            )}

                            {l.status !== 'approved' && (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleApproveLeave(l.id)}
                                disabled={leaveActionLoading === l.id}
                                startIcon={<CheckIcon className="w-3 h-3 text-emerald-600" />}
                                sx={{
                                  borderRadius: '8px',
                                  textTransform: 'none',
                                  fontWeight: 700,
                                  fontSize: '0.7rem',
                                  bgcolor: '#f0fdf4',
                                  color: '#166534',
                                  borderColor: '#bbf7d0',
                                  '&:hover': { bgcolor: '#dcfce7' },
                                }}
                              >
                                {leaveActionLoading === l.id ? 'Approving...' : 'Approve'}
                              </Button>
                            )}

                            {l.status !== 'rejected' && (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleRejectLeave(l.id)}
                                disabled={leaveActionLoading === l.id}
                                startIcon={<AlertTriangleIcon className="w-3 h-3 text-rose-500" />}
                                sx={{
                                  borderRadius: '8px',
                                  textTransform: 'none',
                                  fontWeight: 700,
                                  fontSize: '0.7rem',
                                  bgcolor: '#fff1f2',
                                  color: '#9f1239',
                                  borderColor: '#fecdd3',
                                  '&:hover': { bgcolor: '#ffe4e6' },
                                }}
                              >
                                {leaveActionLoading === l.id ? 'Rejecting...' : 'Reject'}
                              </Button>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TableContainer>
          </Box>
        )}
      </Box>

      {/* Modals */}
      {selectedSlot && currentOption && (
        <WhatIfSlotModal
          isOpen={whatIfModalOpen}
          onClose={() => setWhatIfModalOpen(false)}
          slot={selectedSlot}
          versionId={currentOption.id}
          rooms={rooms}
          faculty={faculty}
          onSaved={handleReloadCurrentVersion}
        />
      )}

      {currentOption && (
        <ApprovalModal
          isOpen={approvalModalOpen}
          onClose={() => setApprovalModalOpen(false)}
          onConfirm={handleApprovalConfirm}
          action={approvalAction}
          optionRank={currentOption.option_rank}
        />
      )}

      <SubstituteModal
        isOpen={substituteModalOpen}
        onClose={() => setSubstituteModalOpen(false)}
        leave={selectedLeaveForSub}
        onAssigned={loadLeaves}
      />
    </Box>
  );
}
