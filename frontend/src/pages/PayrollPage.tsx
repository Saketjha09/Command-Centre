import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useRates, usePayrollHistory } from '../hooks/usePayroll';
import { RatesTab } from '../components/payroll/RatesTab';
import { RunPayrollTab } from '../components/payroll/RunPayrollTab';
import { HistoryTab } from '../components/payroll/HistoryTab';

type Tab = 'rates' | 'run' | 'history';

export default function PayrollPage() {
  const { role } = useAuth();
  
  // Rules of Hooks: Call all hooks before any conditional returns
  const ratesHook = useRates();
  const historyHook = usePayrollHistory();

  const [activeTab, setActiveTab] = useState<Tab>('run');

  // Auth Guard
  if (role !== 'superadmin' && role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  const handleRunCreated = () => {
    setActiveTab('history');
    // Force a manual refresh of the history list
    historyHook.loadRuns();
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl animate-in fade-in duration-500">
      {/* Page Header (Matching UserManagementPage) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 tracking-tight">Payroll</h1>
          <p className="text-gray-500 text-sm mt-1 max-w-md">
            Manage editor rates, generate payroll runs, and track payment history.
          </p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-10 border-b border-[#2e2e2e] mb-10">
        <button 
          onClick={() => setActiveTab('run')}
          className={`pb-4 text-[11px] font-bold uppercase tracking-[0.2em] transition-all ${
            activeTab === 'run' 
              ? 'text-blue-500 border-b-2 border-blue-500' 
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Run Payroll
        </button>
        <button 
          onClick={() => setActiveTab('rates')}
          className={`pb-4 text-[11px] font-bold uppercase tracking-[0.2em] transition-all ${
            activeTab === 'rates' 
              ? 'text-blue-500 border-b-2 border-blue-500' 
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Rates
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`pb-4 text-[11px] font-bold uppercase tracking-[0.2em] transition-all ${
            activeTab === 'history' 
              ? 'text-blue-500 border-b-2 border-blue-500' 
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          History
        </button>
      </div>

      {/* Tab Content */}
      <div className="animate-in slide-in-from-bottom-2 duration-300">
        {activeTab === 'run' && (
          <RunPayrollTab 
            onRunCreated={handleRunCreated}
            rates={ratesHook.rates}
            ratesLoading={ratesHook.loading}
          />
        )}
        {activeTab === 'rates' && <RatesTab {...ratesHook} />}
        {activeTab === 'history' && <HistoryTab {...historyHook} />}
      </div>
    </div>
  );
}
