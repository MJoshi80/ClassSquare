import React from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Box,
  Typography,
  Button,
  Chip,
  Container,
} from '@mui/material';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import ClassSquareLogo from './ClassSquareLogo';
import NotificationDropdown from './NotificationDropdown';
import { useAuth } from '../contexts/AuthContext';

const roleChipColors = {
  admin: { bgcolor: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' },
  hod: { bgcolor: '#faf5ff', color: '#6b21a8', border: '1px solid #e9d5ff' },
  faculty: { bgcolor: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' },
  student: { bgcolor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' },
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  const navLinks = [];
  if (user.role === 'admin') {
    navLinks.push({ label: 'Data Hub', path: '/admin' });
    navLinks.push({ label: 'HOD Studio', path: '/hod' });
    navLinks.push({ label: 'Faculty Portal', path: '/faculty' });
    navLinks.push({ label: 'Student Portal', path: '/student' });
  } else if (user.role === 'hod') {
    navLinks.push({ label: 'HOD Studio', path: '/hod' });
    navLinks.push({ label: 'Faculty Portal', path: '/faculty' });
    navLinks.push({ label: 'Student Portal', path: '/student' });
  } else if (user.role === 'faculty') {
    navLinks.push({ label: 'Faculty Portal', path: '/faculty' });
  } else if (user.role === 'student') {
    navLinks.push({ label: 'Student Portal', path: '/student' });
  }

  const roleStyle = roleChipColors[user.role] || {
    bgcolor: '#f1f5f9',
    color: '#334155',
    border: '1px solid #cbd5e1',
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(226, 232, 240, 0.85)',
        color: '#0f172a',
      }}
      className="no-print"
    >
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ minHeight: { xs: 64, md: 70 }, display: 'flex', justifyContent: 'space-between' }}>
          
          {/* Brand Logo & ClassSquare Title */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Box
              component={Link}
              to="/"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                textDecoration: 'none',
                color: 'inherit',
                transition: 'transform 0.15s ease',
                '&:hover': { transform: 'scale(1.02)' },
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
                    fontSize: '0.65rem',
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

            {/* Navigation Link Buttons */}
            <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1, ml: 2 }}>
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path;
                return (
                  <Button
                    key={link.path}
                    component={Link}
                    to={link.path}
                    variant={isActive ? 'contained' : 'text'}
                    size="small"
                    sx={{
                      borderRadius: '12px',
                      px: 2,
                      py: 0.8,
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      bgcolor: isActive ? '#eff6ff' : 'transparent',
                      color: isActive ? '#1d61f2' : '#475569',
                      border: isActive ? '1px solid #bfdbfe' : '1px solid transparent',
                      boxShadow: 'none',
                      '&:hover': {
                        bgcolor: isActive ? '#eff6ff' : '#f8fafc',
                        borderColor: isActive ? '#93c5fd' : '#e2e8f0',
                        color: isActive ? '#1d61f2' : '#0f172a',
                        boxShadow: 'none',
                      },
                    }}
                  >
                    {link.label}
                  </Button>
                );
              })}
            </Box>
          </Box>

          {/* Right Section: Notifications + User Status + Logout */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2 } }}>
            <NotificationDropdown />

            {/* User Account Info */}
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, flexDirection: 'column', alignItems: 'flex-end' }}>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }}>
                {user.email}
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8' }}>
                Institutional Account
              </Typography>
            </Box>

            {/* Role Chip */}
            <Chip
              label={user.role}
              size="small"
              sx={{
                fontWeight: 800,
                fontSize: '0.75rem',
                textTransform: 'capitalize',
                borderRadius: '8px',
                px: 0.5,
                height: 26,
                ...roleStyle,
              }}
            />

            {/* Logout Button */}
            <Button
              variant="outlined"
              size="small"
              onClick={handleLogout}
              startIcon={<ExitToAppIcon sx={{ fontSize: '1rem !important' }} />}
              sx={{
                borderRadius: '10px',
                borderColor: '#e2e8f0',
                color: '#475569',
                px: 1.5,
                py: 0.6,
                fontSize: '0.75rem',
                fontWeight: 700,
                '&:hover': {
                  borderColor: '#cbd5e1',
                  bgcolor: '#f8fafc',
                  color: '#0f172a',
                },
              }}
            >
              Logout
            </Button>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
