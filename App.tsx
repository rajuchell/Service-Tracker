
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
      const { data: therapistData, error: tError } = await supabase
        .from('therapists')
        .select('name')
        .order('name', { ascending: true });
      
      if (tError) throw tError;
      setTherapists(therapistData.map(t => t.name));

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
      fetchData();
    } catch (error) {
      console.error('Submission error:', error);
      alert('Failed to save entry.');
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
    } catch (error: any) {
      alert(error.code === '23505' ? 'Already exists.' : 'Error saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeTherapist = async (name: string) => {
    if (!window.confirm(`Remove ${name}?`)) return;
    try {
      await supabase.from('therapists').delete().eq('name', name);
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
        {/* Header - Aligned Center when collapsed, Start when expanded */}
        <div className="p-4 lg:p-6 border-b border-border-light flex items-center justify-center lg:justify-start gap-3">
          <div className="flex items-center justify-center size-10 rounded-xl bg-primary/20 text-primary-dark shrink-0">
            <span className="material-symbols-outlined font-bold">grid_view</span>
          </div>
          <h1 className="text-xl font-black tracking-tight text-text-main-light hidden lg:block overflow-hidden whitespace-nowrap">ServiceLog</h1>
        </div>
        
        {/* Nav - Center aligned buttons in w-20, Start aligned in w-64 */}
        <nav className="flex-1 p-3 flex flex-col gap-2">
          <button 
            onClick={() => setCurrentView('entry')}
            className={`flex items-center justify-center lg:justify-start gap-3 w-full px-0 lg:px-4 py-3 rounded-xl transition-all ${
              currentView === 'entry' 
                ? 'bg-primary/10 text-primary-dark font-black' 
                : 'text-text-sec-light hover:bg-black/5'
            }`}
          >
            <span className="material-symbols-outlined shrink-0">edit_document</span>
            <span className="hidden lg:block text-sm font-bold">New Entry</span>
          </button>
          
          <button 
            onClick={() => setCurrentView('setup')}
            className={`flex items-center justify-center lg:justify-start gap-3 w-full px-0 lg:px-4 py-3 rounded-xl transition-all ${
              currentView === 'setup' 
                ? 'bg-primary/10 text-primary-dark font-black' 
                : 'text-text-sec-light hover:bg-black/5'
            }`}
          >
            <span className="material-symbols-outlined shrink-0">settings</span>
            <span className="hidden lg:block text-sm font-bold">Staff Setup</span>
          </button>
        </nav>

        {/* Footer Profile - Center aligned in w-20, Start aligned in w-64 */}
        <div className="p-4 border-t border-border-light">
          <div className="flex items-center justify-center lg:justify-start gap-3">
            <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
              <span className="material-symbols-outlined">account_circle</span>
            </div>
            <div className="hidden lg:block overflow-hidden">
              <p className="text-xs font-black text-text-main-light truncate">Administrator</p>
              <p className="text-[10px] text-text-sec-light font-bold truncate uppercase tracking-widest">Active Branch</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        <header className="sticky top-0 z-40 w-full border-b border-border-light bg-surface-light/80 backdrop-blur-md px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-text-sec-light">
            <span className="material-symbols-outlined text-[18px]">calendar_today</span>
            <span>{formattedDate} • {formattedTime}</span>
          </div>
          <div className="flex items-center gap-4">
            {isLoading && <div className="text-[10px] text-primary-dark font-black animate-pulse uppercase tracking-widest">Syncing Cloud</div>}
            <div className="h-6 w-px bg-border-light"></div>
            <div className="text-right">
              <p className="text-sm font-black text-text-main-light uppercase tracking-tighter">Main Branch #01</p>
            </div>
          </div>
        </header>

        <main className="p-8 max-w-5xl mx-auto w-full">
          {currentView === 'entry' ? (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex flex-col gap-1">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Daily Entry</h2>
                <p className="text-slate-500 font-medium">Record new service transactions and payment split.</p>
              </div>

              <div className="bg-surface-light rounded-3xl shadow-sm border border-border-light overflow-hidden">
                <form onSubmit={handleSubmit} className="p-8 grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-8">
                  <div className="col-span-1 md:col-span-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Bill No <span className="text-red-500">*</span></label>
                    <input name="billNo" value={formData.billNo} onChange={handleInputChange} className="w-full px-4 py-3 bg-background-light border border-border-light rounded-xl font-bold placeholder-slate-300 focus:ring-2 focus:ring-primary outline-none" placeholder="B-001" required />
                  </div>

                  <div className="col-span-1 md:col-span-5">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Customer Name <span className="text-red-500">*</span></label>
                    <input name="customerName" value={formData.customerName} onChange={handleInputChange} className="w-full px-4 py-3 bg-background-light border border-border-light rounded-xl font-bold placeholder-slate-300 focus:ring-2 focus:ring-primary outline-none" placeholder="Full Name" required />
                  </div>

                  <div className="col-span-1 md:col-span-4">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Phone No</label>
                    <input name="phoneNo" value={formData.phoneNo} onChange={handleInputChange} className="w-full px-4 py-3 bg-background-light border border-border-light rounded-xl font-bold placeholder-slate-300 focus:ring-2 focus:ring-primary outline-none" placeholder="9876543210" type="tel" />
                  </div>

                  <div className="col-span-1 md:col-span-6">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Select Therapist <span className="text-red-500">*</span></label>
                    <select name="staffName" value={formData.staffName} onChange={handleInputChange} className="w-full px-4 py-3 bg-background-light border border-border-light rounded-xl font-bold focus:ring-2 focus:ring-primary outline-none appearance-none cursor-pointer" required>
                      <option value="">-- Select Staff --</option>
                      {therapists.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </div>

                  <div className="col-span-1 md:col-span-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">In Time</label>
                      <button type="button" onClick={setInTimeNow} className="px-2 py-0.5 bg-[#e6ffed] text-[#00c853] font-black text-[9px] rounded-md uppercase">NOW</button>
                    </div>
                    <div className="relative flex items-center justify-between w-full h-[52px] px-4 bg-background-light border border-border-light rounded-xl">
                      <span className="font-bold text-slate-900">{formData.inTime || "00:00"}</span>
                      <input name="inTime" value={formData.inTime} onChange={handleInputChange} className="absolute inset-0 opacity-0 cursor-pointer" type="time" required />
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Out Time</label>
                      <button type="button" onClick={setOutTimeNow} className="px-2 py-0.5 bg-[#e6ffed] text-[#00c853] font-black text-[9px] rounded-md uppercase">NOW</button>
                    </div>
                    <div className="relative flex items-center justify-between w-full h-[52px] px-4 bg-background-light border border-border-light rounded-xl">
                      <span className="font-bold text-slate-900">{formData.outTime || "00:00"}</span>
                      <input name="outTime" value={formData.outTime} onChange={handleInputChange} className="absolute inset-0 opacity-0 cursor-pointer" type="time" />
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-12 pt-4 flex items-center justify-between border-t border-slate-100 mt-4">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Breakdown</h3>
                    <div className="bg-[#e6ffed] px-4 py-2 rounded-xl border border-[#00c853]/10">
                      <span className="text-[10px] font-black text-[#00c853] uppercase tracking-widest mr-3">Collection:</span>
                      <span className="text-xl font-black text-slate-900">₹{totalReceived.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Cash</label>
                    <input name="cash" value={formData.payment.cash || ''} onChange={handlePaymentChange} className="w-full px-4 py-3 bg-background-light border border-border-light rounded-xl font-bold focus:ring-2 focus:ring-primary outline-none" placeholder="0" type="number" />
                  </div>
                  <div className="col-span-1 md:col-span-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Card</label>
                    <input name="card" value={formData.payment.card || ''} onChange={handlePaymentChange} className="w-full px-4 py-3 bg-background-light border border-border-light rounded-xl font-bold focus:ring-2 focus:ring-primary outline-none" placeholder="0" type="number" />
                  </div>
                  <div className="col-span-1 md:col-span-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">GPay</label>
                    <input name="gpay" value={formData.payment.gpay || ''} onChange={handlePaymentChange} className="w-full px-4 py-3 bg-background-light border border-border-light rounded-xl font-bold focus:ring-2 focus:ring-primary outline-none" placeholder="0" type="number" />
                  </div>
                  <div className="col-span-1 md:col-span-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">UPI</label>
                    <input name="upi" value={formData.payment.upi || ''} onChange={handlePaymentChange} className="w-full px-4 py-3 bg-background-light border border-border-light rounded-xl font-bold focus:ring-2 focus:ring-primary outline-none" placeholder="0" type="number" />
                  </div>

                  <div className="col-span-1 md:col-span-12 pt-6 flex items-center justify-end gap-6">
                    <button type="button" onClick={resetForm} className="text-xs font-black text-slate-400 uppercase hover:text-slate-600 transition-colors">Clear</button>
                    <button type="submit" disabled={isSubmitting} className="px-12 py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:bg-primary-dark active:scale-95 transition-all disabled:opacity-50">
                      {isSubmitting ? 'SAVING...' : 'SAVE RECORD'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex flex-col gap-1">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Staff Management</h2>
                <p className="text-slate-500 font-medium">Update the list of therapists available in the system.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                <div className="col-span-1 md:col-span-5">
                  <div className="bg-surface-light rounded-3xl border border-border-light p-8 shadow-sm">
                    <h3 className="text-sm font-black text-slate-900 mb-6 uppercase tracking-widest">Register Staff</h3>
                    <form onSubmit={handleAddTherapist} className="space-y-4">
                      <input value={newTherapist} onChange={(e) => setNewTherapist(e.target.value)} className="w-full px-4 py-3 bg-background-light border border-border-light rounded-xl font-bold outline-none" placeholder="Enter Full Name" required />
                      <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all disabled:opacity-50 uppercase text-xs tracking-widest">Add to Database</button>
                    </form>
                  </div>
                </div>

                <div className="col-span-1 md:col-span-7">
                  <div className="bg-surface-light rounded-3xl border border-border-light shadow-sm overflow-hidden">
                    <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Roster ({therapists.length})</h3>
                    </div>
                    <div className="divide-y divide-slate-50 max-h-[480px] overflow-y-auto">
                      {therapists.map((name) => (
                        <div key={name} className="px-8 py-4 flex items-center justify-between group hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="size-10 rounded-full bg-primary/10 text-primary-dark flex items-center justify-center font-black text-sm">{name.charAt(0)}</div>
                            <span className="font-bold text-slate-700">{name}</span>
                          </div>
                          <button onClick={() => removeTherapist(name)} className="size-9 rounded-xl text-red-400 hover:bg-red-50 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"><span className="material-symbols-outlined text-[20px]">delete</span></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
