import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardProvider } from './context/DashboardContext';
import Layout from './components/Layout';

const Overview = lazy(() => import('./pages/Overview'));
const Devices = lazy(() => import('./pages/Devices'));
const Recordings = lazy(() => import('./pages/Recordings'));
const Settings = lazy(() => import('./pages/Settings'));
const DeviceDetails = lazy(() => import('./pages/DeviceDetails'));

const LoadingFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#94a3b8' }}>
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <DashboardProvider>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Overview />} />
              <Route path="overview" element={<Overview />} />
              <Route path="devices" element={<Devices />} />
              <Route path="devices/:deviceId" element={<DeviceDetails />} />
              <Route path="recordings" element={<Recordings />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </DashboardProvider>
    </BrowserRouter>
  );
}

