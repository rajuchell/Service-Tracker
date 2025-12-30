
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { ServiceEntry, DashboardStats } from './types';

// Supabase configuration - Assuming environment variables are set
const supabaseUrl = (window as any).process?.env?.SUPABASE_URL || 'https://npcnxtwvjvmxcrasvzeu.supabase.co';
const supabaseAnonKey = (window as any).process?.env?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wY254dHd2anZteGNyYXN2emV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwODU2OTAsImV4cCI6MjA4MjY2MTY5MH0.Q4HRcMbggPxNk5J_Vm0MTNe9HwsmJ-6KKWgNE9PUQCA';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type ViewState = 'entry' | 'setup';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('entry');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [therapists, setTherapists] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTherapist, setNewTherapist] = useState('');
  
  const inTimeRef = useRef<HTMLInputElement>(null);
  const outTimeRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<ServiceEntry>({
    billNo: '',
    customerName: '',
    phoneNo: '',
    staffName: '',
    inTime: '',
    outTime: '',
    payment: {
      cash: 0,
      card: 0,
      gpay: 0,
      upi: 0,
    },
    remarks: '',
  });

  const [stats, setStats] = useState<DashboardStats>({
    todayEntries: 0,
    cashTotal: 0,
    digitalTotal: 0,
    activeStaff: 0,
  });

  // Fetch initial data from Supabase
  useEffect(() => {
    fetchData();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch Therapists
      const { data: therapistData, error: tError } = await supabase
        .from('therapists')
        .select('name')
        .order('name', { ascending: true });
      
      if (tError) throw tError;
      setTherapists(therapistData.map(t => t.name));

      // Fetch Today's Stats
      const today = new Date().toISOString().split('T')[0];
      const { data: entries, error: eError } = await supabase
        .from('service_entries')
        .select('*')
        .gte('created_at', today);

      if (eError) throw eError;

      const totals = entries.reduce((acc, entry) => {
        const p = entry.payment;
        acc.cash += (p.cash || 0);
        acc.digital += (p.card || 0) + (p.gpay || 0) + (p.upi || 0);
        return acc;
      }, { cash: 0, digital: 0 });

      setStats({
        todayEntries: entries.length,
        cashTotal: totals.cash,
        digitalTotal: totals.digital,
        activeStaff: therapistData.length
      });
    } catch (error) {
      console.error('Error fetching from Supabase:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalReceived = useMemo(() => {
    return (
      Number(formData.payment.cash || 0) +
      Number(formData.payment.card || 0) +
      Number(formData.payment.gpay || 0) +
      Number(formData.payment.upi || 0)
    );
  }, [formData.payment]);

  const getCurrentTimeString = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const setInTimeNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFormData(prev => ({ ...prev, inTime: getCurrentTimeString() }));
  };

  const setOutTimeNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFormData(prev => ({ ...prev, outTime: getCurrentTimeString() }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePaymentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      payment: {
        ...prev.payment,
        [name]: parseFloat(value) || 0,
      },
    }));
  };

  const resetForm = () => {
    setFormData({
      billNo: '',
      customerName: '',
      phoneNo: '',
      staffName: '',
      inTime: '',
      outTime: '',
      payment: {
        cash: 0,
        card: 0,
        gpay: 0,
        upi: 0,
      },
      remarks: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.staffName) {
      alert('Please select a therapist.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('service_entries')
        .insert([{
          bill_no: formData.billNo,
          customer_name: formData.customerName,
          phone_no: formData.phoneNo,
          staff_name: formData.staffName,
          in_time: formData.inTime,
          out_time: formData.outTime,
          payment: formData.payment,
          remarks: formData.remarks
        }]);

      if (error) throw error;
      
      alert('Entry saved to Supabase successfully!');
      resetForm();
      fetchData(); // Refresh stats
    } catch (error) {
      console.error('Submission error:', error);
      alert('Failed to save entry. Check console.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTherapist = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTherapist.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('therapists')
        .insert([{ name: trimmed }]);

      if (error) throw error;

      setNewTherapist('');
      await fetchData();
      alert(`Therapist "${trimmed}" saved.`);
    } catch (error: any) {
      if (error.code === '23505') alert('This therapist already exists.');
      else console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeTherapist = async (name: string) => {
    if (!window.confirm(`Are you sure you want to remove ${name}?`)) return;

    try {
      const { error } = await supabase
        .from('therapists')
        .delete()
        .eq('name', name);

      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const formattedDate = currentTime.toLocaleDateString('en-IN', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const formattedTime = currentTime.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  return (
    <div className="min-h-screen flex bg-background-light">
      {/* Sidebar */}
      <aside className="w-20 lg:w-64 border-r border-border-light bg-surface-light flex flex-col sticky top-0 h-screen z-50 transition-all duration-300">
        <div className="p-4 lg:p-6 border-b border-border-light flex items-center justify-center lg:justify-start gap-3">
          <div className="flex items-center justify-center size-10 rounded-full bg-primary/20 text-primary-dark shrink-0">
            <span className="material-symbols-outlined">grid_view</span>
          </div>
          <h1 className="text-xl font-black tracking-tight text-text-main-light hidden lg:block overflow-hidden whitespace-nowrap">Service Tracker</h1>
        </div>
        
        <nav className="flex-1 p-3 flex flex-col gap-2">
          <button 
            onClick={() => setCurrentView('entry')}
            className={`flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-xl transition-all ${
              currentView === 'entry' 
                ? 'bg-primary/10 text-primary-dark font-bold' 
                : 'text-text-sec-light hover:bg-black/5'
            }`}
          >
            <span className="material-symbols-outlined">edit_document</span>
            <span className="hidden lg:block">Entry</span>
          </button>
          <button 
            onClick={() => setCurrentView('setup')}
            className={`flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-xl transition-all ${
              currentView === 'setup' 
                ? 'bg-primary/10 text-primary-dark font-bold' 
                : 'text-text-sec-light hover:bg-black/5'
            }`}
          >
            <span className="material-symbols-outlined">settings</span>
            <span className="hidden lg:block">Setup</span>
          </button>
        </nav>

        <div className="p-4 border-t border-border-light">
          <div className="flex items-center justify-center lg:justify-start gap-3">
            <div className="bg-center bg-no-repeat bg-cover rounded-full size-10 ring-2 ring-primary/20 shrink-0"
              style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuA32v4b3mnIbuqyBQm-jX31YU9-yeAz-U5bZnAfq2ms6v0f5s4UjdxseRgADGm-gqc5sZJyUMQ81cnKG9LEyelFVancavFSZG9oqx8YYSRJFzuZnoYCPSljv2QE-yi3dtb-y0maTe53HWirA6lMC8DfYmpKxxS4Q114FhEug5SGA5i2WKTr1fxsljYgbKkHsE6o1qS4FjKr5Vnp4qEgOknEOBeVBuR5KlMFGB0cgD8520_tAzF4LT93nMu2Ei9eMEjL6zunstSV5TQ")' }}
            />
            <div className="hidden lg:block overflow-hidden">
              <p className="text-xs font-bold truncate">Jane Doe</p>
              <p className="text-[10px] text-text-sec-light truncate uppercase tracking-widest">Admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Top Header */}
        <header className="sticky top-0 z-40 w-full border-b border-border-light bg-surface-light/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-text-sec-light">
            <span className="material-symbols-outlined text-[18px]">schedule</span>
            <span>{formattedDate} • {formattedTime}</span>
          </div>
          <div className="flex items-center gap-4">
            {isLoading && <div className="text-xs text-primary-dark font-bold animate-pulse">Syncing...</div>}
            <button className="size-10 rounded-full hover:bg-black/5 flex items-center justify-center text-text-sec-light">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <div className="h-6 w-px bg-border-light"></div>
            <div className="text-right">
              <p className="text-sm font-bold leading-none">Main Spa Branch</p>
              <p className="text-xs text-text-sec-light mt-1">Supabase Cloud Connected</p>
            </div>
          </div>
        </header>

        <main className="p-6 md:p-10 flex flex-col items-center">
          <div className="w-full max-w-5xl">
            {currentView === 'entry' ? (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="bg-surface-light rounded-2xl shadow-sm border border-border-light overflow-hidden">
                  <form onSubmit={handleSubmit} className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-8">
                    {/* Section 1: Customer Details */}
                    <div className="col-span-1 md:col-span-12">
                      <h3 className="text-lg font-bold text-text-main-light mb-4 flex items-center gap-2">
                        <span className="flex items-center justify-center size-6 rounded-full bg-text-main-light text-surface-light text-xs font-bold">1</span>
                        Customer Details
                      </h3>
                    </div>

                    <div className="col-span-1 md:col-span-3">
                      <label className="block text-sm font-semibold text-text-main-light mb-2">Bill No <span className="text-red-500">*</span></label>
                      <input
                        name="billNo"
                        value={formData.billNo}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-background-light border border-border-light rounded-lg text-text-main-light placeholder-text-sec-light focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                        placeholder="B-001"
                        required
                        type="text"
                      />
                    </div>

                    <div className="col-span-1 md:col-span-5">
                      <label className="block text-sm font-semibold text-text-main-light mb-2">Customer Name <span className="text-red-500">*</span></label>
                      <input
                        name="customerName"
                        value={formData.customerName}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-background-light border border-border-light rounded-lg text-text-main-light placeholder-text-sec-light focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                        placeholder="Full Name"
                        required
                        type="text"
                      />
                    </div>

                    <div className="col-span-1 md:col-span-4">
                      <label className="block text-sm font-semibold text-text-main-light mb-2">Phone No <span className="text-red-500">*</span></label>
                      <input
                        name="phoneNo"
                        value={formData.phoneNo}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-background-light border border-border-light rounded-lg text-text-main-light placeholder-text-sec-light focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                        placeholder="Mobile Number"
                        required
                        type="tel"
                      />
                    </div>

                    <div className="col-span-1 md:col-span-12 border-t border-border-light my-2"></div>

                    {/* Section 2: Staff & Timing */}
                    <div className="col-span-1 md:col-span-12">
                      <h3 className="text-lg font-bold text-text-main-light mb-4 flex items-center gap-2">
                        <span className="flex items-center justify-center size-6 rounded-full bg-text-main-light text-surface-light text-xs font-bold">2</span>
                        Staff & Timing
                      </h3>
                    </div>

                    <div className="col-span-1 md:col-span-6">
                      <label className="block text-sm font-semibold text-text-main-light mb-2">Therapist / Staff <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <select
                          name="staffName"
                          value={formData.staffName}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 bg-background-light border border-border-light rounded-lg text-text-main-light focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none appearance-none cursor-pointer"
                          required
                        >
                          <option value="">-- Select a Therapist --</option>
                          {therapists.map(name => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-sec-light">
                          expand_more
                        </span>
                      </div>
                    </div>

                    <div className="col-span-1 md:col-span-3">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-bold text-[#1e293b]">In Time <span className="text-red-500">*</span></label>
                        <button 
                          type="button" 
                          onClick={setInTimeNow}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#e6ffed] text-[#00c853] font-black text-[11px] tracking-wide uppercase hover:bg-[#d4f7e0] transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">schedule</span>
                          NOW
                        </button>
                      </div>
                      <div 
                        onClick={() => inTimeRef.current?.showPicker?.()}
                        className="group relative flex items-center justify-between w-full h-[56px] px-5 bg-[#f8faf9] border border-[#e2e8f0] rounded-xl cursor-pointer hover:border-primary transition-all shadow-sm"
                      >
                        <span className="text-xl font-medium text-[#1e293b] tabular-nums">
                          {formData.inTime || "00:00"}
                        </span>
                        <span className="material-symbols-outlined text-[#e2e8f0] group-hover:text-primary transition-colors">
                          schedule
                        </span>
                        <input
                          ref={inTimeRef}
                          name="inTime"
                          value={formData.inTime}
                          onChange={handleInputChange}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          required
                          type="time"
                        />
                      </div>
                    </div>

                    <div className="col-span-1 md:col-span-3">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-bold text-[#1e293b]">Out Time</label>
                        <button 
                          type="button" 
                          onClick={setOutTimeNow}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#e6ffed] text-[#00c853] font-black text-[11px] tracking-wide uppercase hover:bg-[#d4f7e0] transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">schedule</span>
                          NOW
                        </button>
                      </div>
                      <div 
                        onClick={() => outTimeRef.current?.showPicker?.()}
                        className="group relative flex items-center justify-between w-full h-[56px] px-5 bg-[#f8faf9] border border-[#e2e8f0] rounded-xl cursor-pointer hover:border-primary transition-all shadow-sm"
                      >
                        <span className="text-xl font-medium text-[#1e293b] tabular-nums">
                          {formData.outTime || "00:00"}
                        </span>
                        <span className="material-symbols-outlined text-[#e2e8f0] group-hover:text-primary transition-colors">
                          schedule
                        </span>
                        <input
                          ref={outTimeRef}
                          name="outTime"
                          value={formData.outTime}
                          onChange={handleInputChange}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          type="time"
                        />
                      </div>
                    </div>

                    <div className="col-span-1 md:col-span-12 border-t border-border-light my-2"></div>

                    {/* Section 3: Payment */}
                    <div className="col-span-1 md:col-span-12 flex flex-wrap items-center justify-between gap-4">
                      <h3 className="text-lg font-bold text-text-main-light mb-0 flex items-center gap-2">
                        <span className="flex items-center justify-center size-6 rounded-full bg-text-main-light text-surface-light text-xs font-bold">3</span>
                        Payment Breakdown
                      </h3>
                      <div className="px-4 py-1.5 bg-[#e6ffed] rounded-lg border border-[#00c853]/20 flex items-center gap-3">
                        <span className="text-[11px] font-black text-[#00c853] uppercase tracking-wide">TOTAL:</span>
                        <span className="text-xl font-black text-text-main-light tabular-nums">₹{totalReceived.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    <div className="col-span-1 md:col-span-3">
                      <label className="block text-xs font-bold text-text-sec-light uppercase tracking-wider mb-2">Cash</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none font-bold text-text-sec-light">₹</span>
                        <input
                          name="cash"
                          value={formData.payment.cash || ''}
                          onChange={handlePaymentChange}
                          className="w-full pl-8 pr-4 py-3 bg-background-light border border-border-light rounded-lg focus:ring-2 focus:ring-primary outline-none"
                          placeholder="0.00"
                          type="number"
                        />
                      </div>
                    </div>

                    <div className="col-span-1 md:col-span-3">
                      <label className="block text-xs font-bold text-text-sec-light uppercase tracking-wider mb-2">Card</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none font-bold text-text-sec-light">₹</span>
                        <input
                          name="card"
                          value={formData.payment.card || ''}
                          onChange={handlePaymentChange}
                          className="w-full pl-8 pr-4 py-3 bg-background-light border border-border-light rounded-lg focus:ring-2 focus:ring-primary outline-none"
                          placeholder="0.00"
                          type="number"
                        />
                      </div>
                    </div>

                    <div className="col-span-1 md:col-span-3">
                      <label className="block text-xs font-bold text-text-sec-light uppercase tracking-wider mb-2">GPay</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none font-bold text-text-sec-light">₹</span>
                        <input
                          name="gpay"
                          value={formData.payment.gpay || ''}
                          onChange={handlePaymentChange}
                          className="w-full pl-8 pr-4 py-3 bg-background-light border border-border-light rounded-lg focus:ring-2 focus:ring-primary outline-none"
                          placeholder="0.00"
                          type="number"
                        />
                      </div>
                    </div>

                    <div className="col-span-1 md:col-span-3">
                      <label className="block text-xs font-bold text-text-sec-light uppercase tracking-wider mb-2">UPI</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none font-bold text-text-sec-light">₹</span>
                        <input
                          name="upi"
                          value={formData.payment.upi || ''}
                          onChange={handlePaymentChange}
                          className="w-full pl-8 pr-4 py-3 bg-background-light border border-border-light rounded-lg focus:ring-2 focus:ring-primary outline-none"
                          placeholder="0.00"
                          type="number"
                        />
                      </div>
                    </div>

                    <div className="col-span-1 md:col-span-12">
                      <label className="block text-sm font-semibold text-text-main-light mb-2">Remarks</label>
                      <textarea
                        name="remarks"
                        value={formData.remarks}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-background-light border border-border-light rounded-lg text-text-main-light focus:ring-2 focus:ring-primary outline-none min-h-[100px]"
                        placeholder="Additional details..."
                      />
                    </div>

                    <div className="col-span-1 md:col-span-12 pt-6 flex items-center justify-end gap-6">
                      <button 
                        type="button" 
                        onClick={resetForm} 
                        className="text-sm font-bold text-text-sec-light hover:text-text-main-light transition-colors"
                      >
                        Reset
                      </button>
                      <button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="px-12 py-4 bg-[#13ec5b] text-white font-black rounded-xl shadow-lg shadow-[#13ec5b]/20 hover:bg-[#0eb846] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isSubmitting ? <span className="material-symbols-outlined animate-spin">sync</span> : null}
                        {isSubmitting ? 'SAVING...' : 'SUBMIT ENTRY'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col gap-2">
                  <h2 className="text-3xl md:text-4xl font-black tracking-tight text-text-main-light">System Setup</h2>
                  <p className="text-text-sec-light text-base">Managing data in Supabase 'therapists' table.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Add New Therapist */}
                  <div className="col-span-1 md:col-span-5">
                    <div className="bg-surface-light rounded-2xl border border-border-light p-6 shadow-sm">
                      <h3 className="text-lg font-bold text-text-main-light mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary-dark">person_add</span>
                        Add New Therapist
                      </h3>
                      <form onSubmit={handleAddTherapist} className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-text-main-light mb-2">Therapist Name</label>
                          <input 
                            value={newTherapist}
                            onChange={(e) => setNewTherapist(e.target.value)}
                            className="w-full px-4 py-3 bg-background-light border border-border-light rounded-lg focus:ring-2 focus:ring-primary outline-none"
                            placeholder="e.g. Robert Wilson"
                            required
                          />
                        </div>
                        <button 
                          type="submit" 
                          disabled={isSubmitting}
                          className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isSubmitting ? <span className="material-symbols-outlined animate-spin text-[20px]">sync</span> : <span className="material-symbols-outlined text-[20px]">save</span>}
                          {isSubmitting ? 'Saving...' : 'Save Therapist'}
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Therapist List */}
                  <div className="col-span-1 md:col-span-7">
                    <div className="bg-surface-light rounded-2xl border border-border-light shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-border-light flex items-center justify-between">
                        <h3 className="font-bold text-text-main-light">Active Therapists ({therapists.length})</h3>
                        {isLoading && <span className="material-symbols-outlined animate-spin text-text-sec-light">sync</span>}
                      </div>
                      <div className="divide-y divide-border-light max-h-[400px] overflow-y-auto">
                        {therapists.length > 0 ? (
                          therapists.map((name) => (
                            <div key={name} className="px-6 py-4 flex items-center justify-between group hover:bg-background-light transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="size-8 rounded-full bg-primary/10 text-primary-dark flex items-center justify-center font-bold text-xs">
                                  {name.charAt(0)}
                                </div>
                                <span className="font-semibold text-text-main-light">{name}</span>
                              </div>
                              <button 
                                onClick={() => removeTherapist(name)}
                                className="size-8 rounded-lg text-red-400 hover:bg-red-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <span className="material-symbols-outlined text-[20px]">delete</span>
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="p-10 text-center text-text-sec-light">
                            <span className="material-symbols-outlined text-4xl mb-2 opacity-20">no_accounts</span>
                            <p>{isLoading ? 'Loading...' : 'No therapists found.'}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
