/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { QuickEntryModal } from './components/QuickEntryModal';
import { BackupReminder } from './components/BackupReminder';
import { EntryPage } from './pages/EntryPage';
import { BagPage } from './pages/BagPage';
import { OfficesPage } from './pages/OfficesPage';
import { OrdersPage } from './pages/OrdersPage';
import { CapitalPage } from './pages/CapitalPage';
import { SalaryPage } from './pages/SalaryPage';
import { PocketPage } from './pages/PocketPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { CustomersPage } from './pages/CustomersPage';
import { AuditPage } from './pages/AuditPage';
import { ConfirmDeleteProvider } from './components/ConfirmDeleteDialog';

function AppContent() {
  const { currentPage, isQuickModalOpen, closeQuickModal, quickModalTab, state } = useApp();

  return (
    <div
      dir="rtl"
      style={{ backgroundColor: state.settings.appBgColor || '#EDEEF2' }}
      className="min-h-screen text-[#1F1A2E] flex flex-col transition-colors duration-200"
    >
      {/* Backup Reminder Banner */}
      <BackupReminder />

      {/* Navigation Bar (Header + Floating Button + Bottom Sheet) */}
      <Navbar />

      {/* Main Page Content */}
      <main className="flex-1 w-full max-w-[430px] mx-auto px-[15px] pt-[12px] pb-[90px]">
        {currentPage === 'entry' && <EntryPage />}
        {currentPage === 'bag' && <BagPage />}
        {currentPage === 'offices' && <OfficesPage />}
        {currentPage === 'orders' && <OrdersPage />}
        {currentPage === 'customers' && <CustomersPage />}
        {currentPage === 'capital' && <CapitalPage />}
        {currentPage === 'salary' && <SalaryPage />}
        {currentPage === 'pocket' && <PocketPage />}
        {currentPage === 'reports' && <ReportsPage />}
        {currentPage === 'settings' && <SettingsPage />}
        {currentPage === 'audit' && <AuditPage />}
      </main>

      {/* Central Quick Entry Modal */}
      <QuickEntryModal
        isOpen={isQuickModalOpen}
        onClose={closeQuickModal}
        defaultTab={quickModalTab}
      />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ConfirmDeleteProvider>
        <AppContent />
      </ConfirmDeleteProvider>
    </AppProvider>
  );
}
