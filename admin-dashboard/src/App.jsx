import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardProvider } from './context/DashboardContext';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import Devices from './pages/Devices';
import Recordings from './pages/Recordings';
import Settings from './pages/Settings';
import DeviceDetails from './pages/DeviceDetails';

export default function App() {
  return (
    <BrowserRouter>
      <DashboardProvider>
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
      </DashboardProvider>
    </BrowserRouter>
  );
}
