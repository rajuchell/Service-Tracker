
export interface ServiceEntry {
  billNo: string;
  customerName: string;
  phoneNo: string;
  staffName: string;
  inTime: string;
  outTime: string;
  payment: {
    cash: number;
    card: number;
    gpay: number;
    upi: number;
  };
  remarks: string;
}

export interface DashboardStats {
  todayEntries: number;
  cashTotal: number;
  digitalTotal: number;
  activeStaff: number;
}
