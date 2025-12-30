
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { ServiceEntry, DashboardStats } from './types';

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
    } catch (error) {
      console.error('Sync error:', error);
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
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
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
      billNo: '', customerName: '', phoneNo: '', staffName: '', inTime: '', outTime: '',
      payment: { cash: 0, card: 0, gpay: 0, upi: 0 },
      remarks: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.staffName) return alert('Please select a therapist.');

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
      alert('Entry saved successfully!');
      resetForm();
    } catch (error) {
      console.error('Submission error:', error);
      alert('Failed to save record.');
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
      const { error } = await supabase.from('therapists').insert([{ name: trimmed }]);
      if (error) throw error;
      setNewTherapist('');
      await fetchData();
    } catch (error) {
      alert('Error adding therapist.');
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

  const formattedDate = currentTime.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  const formattedTime = currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <div className="min-h-screen flex bg-background-light">
      {/* Sidebar - Precision Alignment */}
      <aside className="w-20 lg:w-64 border-r border-border-light bg-surface-light flex flex-col sticky top-0 h-screen z-50 transition-all duration-300">
        <div className="p-4 lg:p-6 border-b border-border-light flex items-center justify-center lg:justify-start gap-3">
          <div className="flex items-center justify-center size-10 rounded-xl bg-slate-100 text-slate-600 shrink-0">
            <span className="material-symbols-outlined font-bold">grid_view</span>
          </div>
          <h1 className="text-lg font-black tracking-tight text-slate-900 hidden lg:block overflow-hidden whitespace-nowrap uppercase">Bessenyaspa</h1>
        </div>
        
        <nav className="flex-1 p-3 flex flex-col gap-2">
          <button onClick={() => setCurrentView('entry')} className={`flex items-center justify-center lg:justify-start gap-3 w-full px-0 lg:px-4 py-3 rounded-xl transition-all ${currentView === 'entry' ? 'bg-slate-100 text-slate-900 font-black' : 'text-slate-400 hover:bg-slate-50'}`}>
            <span className="material-symbols-outlined shrink-0">edit_document</span>
            <span className="hidden lg:block text-sm font-bold">Entry System</span>
          </button>
          <button onClick={() => setCurrentView('setup')} className={`flex items-center justify-center lg:justify-start gap-3 w-full px-0 lg:px-4 py-3 rounded-xl transition-all ${currentView === 'setup' ? 'bg-slate-100 text-slate-900 font-black' : 'text-slate-400 hover:bg-slate-50'}`}>
            <span className="material-symbols-outlined shrink-0">settings</span>
            <span className="hidden lg:block text-sm font-bold">Staff Setup</span>
          </button>
        </nav>

        <div className="p-4 border-t border-border-light">
          <div className="flex items-center justify-center lg:justify-start gap-3">
            <div className="size-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 shrink-0">
              <span className="material-symbols-outlined">account_circle</span>
            </div>
            <div className="hidden lg:block overflow-hidden">
              <p className="text-xs font-black text-slate-900 truncate">Jane Doe</p>
              <p className="text-[10px] text-slate-400 font-bold truncate uppercase tracking-widest">Admin</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        <header className="sticky top-0 z-40 w-full border-b border-border-light bg-surface-light/80 backdrop-blur-md px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
            <span className="material-symbols-outlined text-[18px]">calendar_today</span>
            <span>{formattedDate} • {formattedTime}</span>
          </div>
          <div className="text-right">
            <p className="text-sm font-black text-slate-900 uppercase tracking-tighter">Bessenyaspa Main</p>
            <p className="text-[10px] text-slate-400 font-medium">{isLoading ? 'Syncing...' : 'Connected'}</p>
          </div>
        </header>

        <main className="p-8 max-w-5xl mx-auto w-full">
          {currentView === 'entry' ? (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex flex-col gap-1">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Daily Record</h2>
                <p className="text-slate-500 font-medium">Capture service transactions for current shift.</p>
              </div>

              <div className="bg-surface-light rounded-3xl shadow-sm border border-border-light overflow-hidden">
                <form onSubmit={handleSubmit} className="p-8 grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-8">
                  <div className="col-span-1 md:col-span-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Bill No</label>
                    <input name="billNo" value={formData.billNo} onChange={handleInputChange} className="w-full px-4 py-3 bg-background-light border border-border-light rounded-xl font-bold placeholder-slate-300 focus:ring-2 focus:ring-slate-200 outline-none" placeholder="B-001" required />
                  </div>
                  <div className="col-span-1 md:col-span-5">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Customer Name</label>
                    <input name="customerName" value={formData.customerName} onChange={handleInputChange} className="w-full px-4 py-3 bg-background-light border border-border-light rounded-xl font-bold placeholder-slate-300 focus:ring-2 focus:ring-slate-200 outline-none" placeholder="Full Name" required />
                  </div>
                  <div className="col-span-1 md:col-span-4">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Phone</label>
                    <input name="phoneNo" value={formData.phoneNo} onChange={handleInputChange} className="w-full px-4 py-3 bg-background-light border border-border-light rounded-xl font-bold placeholder-slate-300 focus:ring-2 focus:ring-slate-200 outline-none" placeholder="9876543210" type="tel" />
                  </div>

                  <div className="col-span-1 md:col-span-6">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Assign Therapist</label>
                    <select name="staffName" value={formData.staffName} onChange={handleInputChange} className="w-full px-4 py-3 bg-background-light border border-border-light rounded-xl font-bold focus:ring-2 focus:ring-slate-200 outline-none appearance-none" required>
                      <option value="">-- Select Staff --</option>
                      {therapists.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </div>

                  <div className="col-span-1 md:col-span-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">In Time</label>
                      <button type="button" onClick={setInTimeNow} className="px-2 py-0.5 bg-slate-100 text-slate-600 font-black text-[9px] rounded-md uppercase border border-slate-200">NOW</button>
                    </div>
                    <div className="relative flex items-center justify-between w-full h-[52px] px-4 bg-background-light border border-border-light rounded-xl">
                      <span className="font-bold text-slate-900">{formData.inTime || "00:00"}</span>
                      <input name="inTime" value={formData.inTime} onChange={handleInputChange} className="absolute inset-0 opacity-0 cursor-pointer" type="time" required />
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Out Time</label>
                      <button type="button" onClick={setOutTimeNow} className="px-2 py-0.5 bg-slate-100 text-slate-600 font-black text-[9px] rounded-md uppercase border border-slate-200">NOW</button>
                    </div>
                    <div className="relative flex items-center justify-between w-full h-[52px] px-4 bg-background-light border border-border-light rounded-xl">
                      <span className="font-bold text-slate-900">{formData.outTime || "00:00"}</span>
                      <input name="outTime" value={formData.outTime} onChange={handleInputChange} className="absolute inset-0 opacity-0 cursor-pointer" type="time" />
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-12 pt-4 flex items-center justify-between border-t border-slate-50 mt-4">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Billing Breakdown</h3>
                    <div className="bg-slate-100 px-6 py-2 rounded-2xl border border-slate-200">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-4">Total:</span>
                      <span className="text-2xl font-black text-slate-900">₹{totalReceived.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {['cash', 'card', 'gpay', 'upi'].map((method) => (
                    <div key={method} className="col-span-1 md:col-span-3">
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">{method}</label>
                      <input name={method} value={(formData.payment as any)[method] || ''} onChange={handlePaymentChange} className="w-full px-4 py-3 bg-background-light border border-border-light rounded-xl font-bold focus:ring-2 focus:ring-slate-200 outline-none" placeholder="0" type="number" />
                    </div>
                  ))}

                  <div className="col-span-1 md:col-span-12">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Remarks</label>
                    <textarea name="remarks" value={formData.remarks} onChange={handleInputChange} className="w-full px-4 py-3 bg-background-light border border-border-light rounded-xl font-bold outline-none min-h-[100px]" placeholder="Additional details..." />
                  </div>

                  <div className="col-span-1 md:col-span-12 pt-6 flex items-center justify-end gap-6">
                    <button type="button" onClick={resetForm} className="text-xs font-black text-slate-400 uppercase hover:text-slate-600 transition-colors">Clear</button>
                    <button type="submit" disabled={isSubmitting} className="px-12 py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-slate-200 hover:bg-primary-dark transition-all disabled:opacity-50">
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
                <p className="text-slate-500 font-medium">Administer the Bessenyaspa therapist database.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                <div className="col-span-1 md:col-span-5">
                  <div className="bg-surface-light rounded-3xl border border-border-light p-8 shadow-sm">
                    <h3 className="text-xs font-black text-slate-900 mb-6 uppercase tracking-widest">Add Therapist</h3>
                    <form onSubmit={handleAddTherapist} className="space-y-4">
                      <input value={newTherapist} onChange={(e) => setNewTherapist(e.target.value)} className="w-full px-4 py-3 bg-background-light border border-border-light rounded-xl font-bold outline-none" placeholder="Enter Full Name" required />
                      <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-primary text-white font-black rounded-xl uppercase text-xs tracking-widest disabled:opacity-50">Register Staff</button>
                    </form>
                  </div>
                </div>
                <div className="col-span-1 md:col-span-7">
                  <div className="bg-surface-light rounded-3xl border border-border-light shadow-sm overflow-hidden">
                    <div className="px-8 py-5 border-b border-slate-50 bg-slate-50/50">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Roster ({therapists.length})</h3>
                    </div>
                    <div className="divide-y divide-slate-50 max-h-[480px] overflow-y-auto">
                      {therapists.map((name) => (
                        <div key={name} className="px-8 py-4 flex items-center justify-between group hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="size-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-black text-sm border border-slate-200">{name.charAt(0)}</div>
                            <span className="font-bold text-slate-700">{name}</span>
                          </div>
                          <button onClick={() => removeTherapist(name)} className="size-9 rounded-xl text-red-400 hover:bg-red-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"><span className="material-symbols-outlined text-[20px]">delete</span></button>
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
