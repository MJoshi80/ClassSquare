import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Box,
  Card,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ClassSquareLogo from '../components/ClassSquareLogo';

export default function LoginPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const roleCredentials = {
    student: {
      label: 'Student',
      desc: 'View timetables & classes',
      letter: 'S',
      color: '#38bdf8',
      bg: 'rgba(56, 189, 248, 0.15)',
      email: 'student.cse@opticlass.edu',
      pass: 'student123',
    },
    faculty: {
      label: 'Faculty',
      desc: 'Manage your schedule',
      letter: 'F',
      color: '#a78bfa',
      bg: 'rgba(139, 92, 246, 0.15)',
      email: 'faculty.turing@opticlass.edu',
      pass: 'faculty123',
    },
    hod: {
      label: 'HOD',
      desc: 'Department overview',
      letter: 'H',
      color: '#e8b94f',
      bg: 'rgba(232, 185, 79, 0.15)',
      email: 'hod.cse@opticlass.edu',
      pass: 'hod123',
    },
    admin: {
      label: 'Admin',
      desc: 'System configuration',
      letter: 'A',
      color: '#f87171',
      bg: 'rgba(239, 68, 68, 0.15)',
      email: 'admin@opticlass.edu',
      pass: 'admin123',
    },
  };

  const [selectedRole, setSelectedRole] = useState('student'); // 'student' | 'faculty' | 'admin' | 'hod'
  const [email, setEmail] = useState(roleCredentials.student.email);
  const [password, setPassword] = useState(roleCredentials.student.pass);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setEmail(roleCredentials[role].email);
    setPassword(roleCredentials[role].pass);
    setError('');
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');

    const targetEmail = email.trim();
    const targetPassword = password;

    if (!targetEmail || !targetPassword) {
      setError('Please enter your institutional email and password.');
      return;
    }

    setLoading(true);

    try {
      const loggedInRole = await login(targetEmail, targetPassword);
      const dashboardMap = {
        admin: '/admin',
        hod: '/hod',
        faculty: '/faculty',
        student: '/student',
      };
      navigate(dashboardMap[loggedInRole?.role || loggedInRole] || '/');
    } catch (err) {
      if (!err.response || err.code === 'ERR_NETWORK') {
        setError('Cannot connect to backend server. Please verify the backend is running on port 8000.');
      } else {
        setError(
          err.response?.data?.detail || 'Authentication failed. Please check your institutional email and password.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#e0f2fe',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 2, sm: 4, md: 6 },
      }}
    >
      <Card
        sx={{
          width: '100%',
          maxWidth: 1100,
          borderRadius: '28px',
          boxShadow: '0 20px 50px -15px rgba(16, 42, 107, 0.15)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          bgcolor: '#ffffff',
        }}
      >
        {/* LEFT COLUMN: Deep ocean-to-royal-blue gradient */}
        <Box
          sx={{
            background: 'linear-gradient(135deg, #0a1329 0%, #0f2757 45%, #1d4ed8 100%)',
            p: { xs: 4, sm: 5, md: 6 },
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
            borderRight: { md: '1px solid rgba(255, 255, 255, 0.08)' },
            borderBottom: { xs: '1px solid rgba(255, 255, 255, 0.08)', md: 'none' },
          }}
        >
          {/* Top Brand Pill with Dashboard Logo */}
          <Box sx={{ position: 'relative', zIndex: 10, alignSelf: 'flex-start', mb: { xs: 6, md: 8 } }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1.8,
                bgcolor: '#ffffff',
                px: 2.2,
                py: 1.2,
                borderRadius: '16px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
              }}
            >
              <ClassSquareLogo size="md" />
              <Box>
                <Typography
                  sx={{
                    fontSize: '1.15rem',
                    fontWeight: 900,
                    color: '#0f172a',
                    letterSpacing: '-0.025em',
                    lineHeight: 1,
                  }}
                >
                  Class<Box component="span" sx={{ color: '#1d61f2' }}>Square</Box>
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    color: '#64748b',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    display: 'block',
                    mt: 0.3,
                  }}
                >
                  Smart Scheduling & Timetable
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box sx={{ position: 'relative', zIndex: 10, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Typography
              sx={{
                color: '#e8b94f',
                fontWeight: 700,
                fontSize: '0.75rem',
                letterSpacing: '0.1em',
                mb: 2,
                textTransform: 'uppercase',
              }}
            >
              Academic Operations / 2026
            </Typography>
            <Typography
              component="h1"
              sx={{
                fontSize: { xs: '2.5rem', sm: '3rem', lg: '3.5rem' },
                fontWeight: 900,
                color: '#ffffff',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
                mb: 3,
              }}
            >
              Make room<br />
              for better<br />
              <span style={{ color: '#e8b94f' }}>learning.</span>
            </Typography>
            <Typography sx={{ color: '#93c5fd', fontSize: '1rem', lineHeight: 1.5, maxWidth: '85%', opacity: 0.95 }}>
              Experience the future of academic scheduling with constraint-aware timetable generation and seamless institutional management.
            </Typography>
          </Box>

          {/* Bottom Pill Badges */}
          <Box
            sx={{
              position: 'relative',
              zIndex: 10,
              pt: { xs: 4, md: 8 },
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1.5,
            }}
          >
            {['ZERO CLASHES', 'NEP READY', 'LIVE REVIEW'].map((badge) => (
              <Box
                key={badge}
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#e8ecf4',
                  px: 2,
                  py: 1,
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                }}
              >
                {badge}
              </Box>
            ))}
          </Box>
        </Box>

        {/* RIGHT COLUMN: White Card */}
        <Box
          sx={{
            bgcolor: '#ffffff',
            p: { xs: 4, sm: 5, md: 6 },
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{ flexGrow: 1 }}>
            <Typography
              component="h2"
              sx={{
                fontSize: { xs: '1.75rem', sm: '2.1rem' },
                fontWeight: 900,
                color: '#0f172a',
                letterSpacing: '-0.025em',
                mb: 1,
              }}
            >
              Choose your portal
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: '0.95rem', mb: 4, lineHeight: 1.5 }}>
              Select how you use the timetable. You can log out whenever you are done.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: '14px', fontSize: '0.85rem', fontWeight: 600 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              {/* Role Selector Grid */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2, mb: 4 }}>
                {Object.entries(roleCredentials).map(([key, data]) => {
                  const isSelected = selectedRole === key;
                  return (
                    <Box
                      key={key}
                      onClick={() => handleRoleSelect(key)}
                      sx={{
                        cursor: 'pointer',
                        p: 2,
                        borderRadius: '16px',
                        border: isSelected ? '2px solid #1d61f2' : '1px solid #e2e8f0',
                        bgcolor: isSelected ? 'rgba(29, 97, 242, 0.04)' : '#ffffff',
                        boxShadow: isSelected ? '0 4px 16px rgba(29, 97, 242, 0.15)' : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1.5,
                        position: 'relative',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: isSelected ? '#1d61f2' : '#cbd5e1',
                          bgcolor: isSelected ? 'rgba(29, 97, 242, 0.04)' : '#f8fafc',
                        },
                      }}
                    >
                      {isSelected && (
                        <CheckCircleIcon
                          sx={{
                            position: 'absolute',
                            top: 12,
                            right: 12,
                            color: '#1d61f2',
                            fontSize: '1.25rem',
                          }}
                        />
                      )}
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: data.bg,
                          color: data.color,
                          fontWeight: 800,
                          fontSize: '1.1rem',
                        }}
                      >
                        {data.letter}
                      </Box>
                      <Box>
                        <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                          {data.label}
                        </Typography>
                        <Typography sx={{ color: '#64748b', fontSize: '0.75rem', mt: 0.3 }}>
                          {data.desc}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', mb: 1 }}>
                  School Email
                </Typography>
                <TextField
                  fullWidth
                  required
                  type="email"
                  name="email"
                  size="medium"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@university.edu"
                  autoComplete="email"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                      fontSize: '0.95rem',
                      bgcolor: '#f8fafc',
                      transition: 'all 0.2s ease',
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#1d61f2',
                        borderWidth: '2px',
                      },
                      '&.Mui-focused': {
                        bgcolor: '#ffffff',
                        boxShadow: '0 0 0 3px rgba(29, 97, 242, 0.15)',
                      },
                    },
                  }}
                />
              </Box>

              <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                    Password
                  </Typography>
                  <Typography
                    component="button"
                    type="button"
                    onClick={() => alert('Please contact your institutional IT administrator to reset your password.')}
                    sx={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: '#1d61f2',
                      background: 'none',
                      border: 'none',
                      p: 0,
                      cursor: 'pointer',
                      '&:hover': { textDecoration: 'underline' },
                    }}
                  >
                    Forgot?
                  </Typography>
                </Box>
                <TextField
                  fullWidth
                  required
                  size="medium"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle password visibility"
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          size="small"
                        >
                          {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                      fontSize: '0.95rem',
                      bgcolor: '#f8fafc',
                      transition: 'all 0.2s ease',
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#1d61f2',
                        borderWidth: '2px',
                      },
                      '&.Mui-focused': {
                        bgcolor: '#ffffff',
                        boxShadow: '0 0 0 3px rgba(29, 97, 242, 0.15)',
                      },
                    },
                  }}
                />
              </Box>

              <Button
                fullWidth
                type="submit"
                variant="contained"
                disabled={loading}
                sx={{
                  py: 1.8,
                  background: 'linear-gradient(135deg, #1d61f2 0%, #2563eb 50%, #3b82f6 100%)',
                  fontSize: '1rem',
                  fontWeight: 800,
                  borderRadius: '14px',
                  boxShadow: '0 10px 25px -5px rgba(29, 97, 242, 0.45)',
                  textTransform: 'none',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #184cc2 0%, #1d4ed8 50%, #2563eb 100%)',
                    boxShadow: '0 12px 28px -5px rgba(29, 97, 242, 0.6)',
                  },
                }}
              >
                {loading ? (
                  <CircularProgress size={24} sx={{ color: '#ffffff' }} />
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </Box>

          {/* Institutional Footer */}
          <Box sx={{ pt: 3, mt: 4, borderTop: '1px solid #f1f5f9' }}>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textAlign: 'center', letterSpacing: '0.05em' }}>
              CONSTRAINT-AWARE SCHEDULING · HUMAN-READABLE REVIEW · NEP 2020 READY
            </Typography>
          </Box>
        </Box>
      </Card>
    </Box>
  );
}
