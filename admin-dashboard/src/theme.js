import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00e5ff',
      light: '#67e8f9',
      dark: '#0097a7',
      contrastText: '#000',
    },
    secondary: {
      main: '#00e676',
      light: '#69f0ae',
      dark: '#00b248',
      contrastText: '#000',
    },
    error: {
      main: '#ff1744',
      light: '#ff616f',
      dark: '#c4001d',
    },
    warning: {
      main: '#f59e0b',
      light: '#fcd34d',
      dark: '#b45309',
    },
    success: {
      main: '#00e676',
      dark: '#00b248',
    },
    background: {
      default: '#07090e',
      paper: '#0d121d',
    },
    text: {
      primary: '#f1f5f9',
      secondary: '#94a3b8',
      disabled: '#475569',
    },
    divider: 'rgba(255,255,255,0.08)',
  },

  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    h1: { fontWeight: 700, letterSpacing: '-0.5px' },
    h2: { fontWeight: 700, letterSpacing: '-0.3px' },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    body1: { fontSize: '0.875rem' },
    body2: { fontSize: '0.8125rem' },
    caption: { fontSize: '0.75rem', color: '#94a3b8' },
    overline: {
      fontFamily: '"JetBrains Mono", "Courier New", monospace',
      fontSize: '0.625rem',
      letterSpacing: '0.08em',
      fontWeight: 700,
    },
  },

  shape: {
    borderRadius: 12,
  },

  shadows: [
    'none',
    '0 1px 3px rgba(0,0,0,0.4)',
    '0 2px 8px rgba(0,0,0,0.5)',
    '0 4px 16px rgba(0,0,0,0.5)',
    '0 6px 20px rgba(0,0,0,0.6)',
    '0 8px 24px rgba(0,0,0,0.6)',
    '0 10px 32px rgba(0,0,0,0.65)',
    '0 12px 40px rgba(0,0,0,0.7)',
    '0 16px 48px rgba(0,0,0,0.7)',
    '0 20px 56px rgba(0,0,0,0.75)',
    '0 24px 64px rgba(0,0,0,0.8)',
    '0 28px 72px rgba(0,0,0,0.8)',
    '0 32px 80px rgba(0,0,0,0.85)',
    '0 36px 88px rgba(0,0,0,0.85)',
    '0 40px 96px rgba(0,0,0,0.9)',
    '0 44px 104px rgba(0,0,0,0.9)',
    '0 48px 112px rgba(0,0,0,0.9)',
    '0 52px 120px rgba(0,0,0,0.9)',
    '0 56px 128px rgba(0,0,0,0.9)',
    '0 60px 136px rgba(0,0,0,0.9)',
    '0 64px 144px rgba(0,0,0,0.9)',
    '0 68px 152px rgba(0,0,0,0.9)',
    '0 72px 160px rgba(0,0,0,0.9)',
    '0 76px 168px rgba(0,0,0,0.9)',
    '0 80px 176px rgba(0,0,0,0.9)',
  ],

  components: {
    MuiCssBaseline: {
      styleOverrides: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        html, body { 
          margin: 0; padding: 0; height: 100%;
          background: #07090e;
          color: #f1f5f9;
          font-family: 'Inter', sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        
        #root { height: 100%; display: flex; flex-direction: column; }

        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); }
        ::-webkit-scrollbar-thumb { background: rgba(0,229,255,0.2); border-radius: 9999px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(0,229,255,0.4); }

        /* CCTV viewport styles */
        .cctv-viewport {
          position: relative;
          background: 
            linear-gradient(rgba(0,229,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,229,255,0.04) 1px, transparent 1px),
            radial-gradient(ellipse at center, #0c1830 0%, #07090e 100%);
          background-size: 20px 20px, 20px 20px, 100% 100%;
          overflow: hidden;
        }

        .cctv-viewport::before {
          content: '';
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg, transparent, transparent 2px,
            rgba(0, 0, 0, 0.08) 2px, rgba(0, 0, 0, 0.08) 4px
          );
          pointer-events: none;
          z-index: 1;
          animation: scanlines 8s linear infinite;
        }

        .cctv-bracket-tl,
        .cctv-bracket-tr,
        .cctv-bracket-bl,
        .cctv-bracket-br {
          position: absolute;
          width: 20px;
          height: 20px;
          z-index: 5;
        }
        .cctv-bracket-tl { top: 8px; left: 8px; border-top: 2px solid #00e5ff; border-left: 2px solid #00e5ff; }
        .cctv-bracket-tr { top: 8px; right: 8px; border-top: 2px solid #00e5ff; border-right: 2px solid #00e5ff; }
        .cctv-bracket-bl { bottom: 8px; left: 8px; border-bottom: 2px solid #00e5ff; border-left: 2px solid #00e5ff; }
        .cctv-bracket-br { bottom: 8px; right: 8px; border-bottom: 2px solid #00e5ff; border-right: 2px solid #00e5ff; }

        .cctv-crosshair {
          position: absolute;
          top: 50%; left: 50%;
          width: 28px; height: 28px;
          transform: translate(-50%, -50%);
          border: 1px solid rgba(0,229,255,0.25);
          border-radius: 50%;
          z-index: 3;
        }
        .cctv-crosshair::before, .cctv-crosshair::after {
          content: '';
          position: absolute;
          background: rgba(0,229,255,0.25);
        }
        .cctv-crosshair::before { width: 1px; height: 16px; top: -8px; left: 50%; transform: translateX(-50%); }
        .cctv-crosshair::after { height: 1px; width: 16px; left: -8px; top: 50%; transform: translateY(-50%); }

        /* Live radar spinner */
        .live-radar-spinner {
          width: 56px; height: 56px;
          border-radius: 50%;
          border: 2px solid rgba(0,229,255,0.15);
          border-top-color: #00e5ff;
          animation: radarSpin 1.2s linear infinite;
          margin: 0 auto 16px;
        }

        /* Spinning refresh icon */
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes radarSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes scanlines {
          from { background-position: 0 0; }
          to { background-position: 0 40px; }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes radar-dot-pulse {
          0% { transform: scale(1); opacity: 1; }
          70% { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }

        .spinning { animation: spin 1s linear infinite; }
        .radar-pulse { animation: radar-dot-pulse 2s ease-out infinite; }

        .font-mono { font-family: 'JetBrains Mono', 'Courier New', monospace !important; }
      `,
    },

    MuiCard: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(180deg, rgba(16,23,38,0.92) 0%, rgba(12,18,30,0.95) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: 16,
          transition: 'all 0.25s ease',
          '&:hover': {
            borderColor: 'rgba(0,229,255,0.3)',
          },
        },
      },
    },

    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.8rem',
          letterSpacing: '0.01em',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
        outlined: {
          borderColor: 'rgba(255,255,255,0.12)',
          '&:hover': {
            borderColor: 'rgba(0,229,255,0.4)',
            backgroundColor: 'rgba(0,229,255,0.05)',
          },
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: 'all 0.2s ease',
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
          fontSize: '0.7rem',
          fontFamily: '"JetBrains Mono", monospace',
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottomColor: 'rgba(255,255,255,0.05)',
          fontSize: '0.8125rem',
        },
        head: {
          background: 'rgba(8,13,22,0.9)',
          color: '#64748b',
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          fontFamily: '"JetBrains Mono", monospace',
        },
      },
    },

    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.02)',
          },
        },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          background: 'rgba(16,23,38,0.9)',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255,255,255,0.08)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(0,229,255,0.3)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#00e5ff',
            borderWidth: 1,
          },
        },
        input: {
          color: '#f1f5f9',
          fontSize: '0.8125rem',
          '&::placeholder': { color: '#475569', opacity: 1 },
        },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 9999,
          background: 'rgba(255,255,255,0.08)',
          height: 6,
        },
        bar: {
          borderRadius: 9999,
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          background: '#0d1422',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          backdropFilter: 'blur(24px)',
        },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: '#080d17',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          width: 260,
        },
      },
    },

    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'rgba(13,18,29,0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          boxShadow: 'none',
        },
      },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          margin: '2px 8px',
          width: 'calc(100% - 16px)',
          transition: 'all 0.2s ease',
          '&:hover': {
            background: 'rgba(0,229,255,0.06)',
          },
          '&.Mui-selected': {
            background: 'rgba(0,229,255,0.12)',
            borderLeft: '3px solid #00e5ff',
            color: '#00e5ff',
            '&:hover': {
              background: 'rgba(0,229,255,0.16)',
            },
            '& .MuiListItemIcon-root': {
              color: '#00e5ff',
            },
          },
        },
      },
    },

    MuiListItemIcon: {
      styleOverrides: {
        root: {
          minWidth: 36,
          color: '#64748b',
          transition: 'color 0.2s ease',
        },
      },
    },

    MuiListItemText: {
      styleOverrides: {
        primary: {
          fontSize: '0.875rem',
          fontWeight: 500,
        },
      },
    },

    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(255,255,255,0.07)',
        },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          background: 'rgba(8,13,22,0.95)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#f1f5f9',
          fontSize: '0.75rem',
          borderRadius: 8,
        },
        arrow: {
          color: 'rgba(8,13,22,0.95)',
        },
      },
    },

    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderRadius: '10px !important',
          border: '1px solid rgba(255,255,255,0.08) !important',
          color: '#64748b',
          fontSize: '0.75rem',
          fontWeight: 600,
          textTransform: 'none',
          padding: '5px 14px',
          '&.Mui-selected': {
            backgroundColor: 'rgba(0,229,255,0.15)',
            borderColor: 'rgba(0,229,255,0.4) !important',
            color: '#00e5ff',
          },
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.04)',
          },
        },
      },
    },

    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          gap: 6,
        },
        grouped: {
          '&:not(:first-of-type)': {
            borderLeft: '1px solid rgba(255,255,255,0.08) !important',
            marginLeft: 0,
          },
        },
      },
    },

    MuiPagination: {
      styleOverrides: {
        root: {
          '& .MuiPaginationItem-root': {
            color: '#94a3b8',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.08)',
            fontSize: '0.8rem',
            '&:hover': { background: 'rgba(255,255,255,0.06)' },
            '&.Mui-selected': {
              background: 'rgba(0,229,255,0.15)',
              borderColor: 'rgba(0,229,255,0.4)',
              color: '#00e5ff',
            },
          },
        },
      },
    },
  },
});

export default theme;
