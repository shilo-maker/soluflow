import React, { useState, useCallback } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import Sidebar from './Sidebar';
import Header from './Header';

const AppLayout = ({ children, user, onLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { language } = useLanguage();
  const isRtl = language === 'he';

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <div className="app-layout" dir={isRtl ? 'rtl' : 'ltr'}>
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

      <Header
        user={user}
        showLogout={true}
        onLogout={onLogout}
        onMenuToggle={toggleSidebar}
      />

      <main className="app-main-content">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
