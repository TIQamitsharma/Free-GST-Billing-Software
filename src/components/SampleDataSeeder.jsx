import { useState } from 'react';
import { Database, CircleCheck as CheckCircle, Loader } from 'lucide-react';
import {
  saveProfile, saveClient, saveProduct, saveExpense, savePurchase,
  saveReceipt, saveRecurring, saveBill,
} from '../store';
import { toast } from './Toast';

const PROFILE = {
  businessName: 'Technocratiq Digital Pvt. Ltd.',
  address: '42, MG Road, Sector 15',
  city: 'Gurugram',
  pin: '122001',
  state: 'Haryana',
  country: 'India',
  gstin: '06AABCT1234F1ZV',
  pan: 'AABCT1234F',
  email: 'billing@technocratiq.com',
  phone: '+91 98765 43210',
  bankName: 'HDFC Bank',
  accountNumber: '50100123456789',
  ifsc: 'HDFC0001234',
  upiId: 'technocratiq@upi',
  googleDriveFolder: 'GST Billing Invoices',
};

const CLIENTS = [
  { id: 'cli_sample_1', name: 'Sunrise Technologies Pvt. Ltd.', address: '12, Connaught Place, New Delhi 110001', city: 'New Delhi', pin: '110001', state: 'Delhi', country: 'India', gstin: '07AAACS1234B1ZP', email: 'accounts@sunrisetech.in', phone: '+91 11 4567 8900' },
  { id: 'cli_sample_2', name: 'Bharat Manufacturing Co.', address: '5, GIDC Estate, Vatva', city: 'Ahmedabad', pin: '382445', state: 'Gujarat', country: 'India', gstin: '24AABCB5678C1ZK', email: 'finance@bharatmfg.com', phone: '+91 79 2683 1234' },
  { id: 'cli_sample_3', name: 'Apex Retail Solutions', address: '88, Brigade Road', city: 'Bengaluru', pin: '560025', state: 'Karnataka', country: 'India', gstin: '29AABCA9876D1ZM', email: 'ap@apexretail.com', phone: '+91 80 4567 2345' },
  { id: 'cli_sample_4', name: 'Global Exports Ltd.', address: 'Unit 4, SEZ Sector 8, NOIDA', city: 'NOIDA', pin: '201301', state: 'Uttar Pradesh', country: 'India', gstin: '', email: 'exports@globalexports.in', phone: '+91 120 456 7890', isSEZ: true },
];

const PRODUCTS = [
  { id: 'prod_sample_1', name: 'Web Development Service', description: 'Full-stack website development', unit: 'project', rate: 50000, taxPercent: 18, hsn: '998314', category: 'Service', stock: 999, lowStockAlert: 0 },
  { id: 'prod_sample_2', name: 'SEO Monthly Package', description: 'Monthly SEO & digital marketing', unit: 'month', rate: 15000, taxPercent: 18, hsn: '998361', category: 'Service', stock: 999, lowStockAlert: 0 },
  { id: 'prod_sample_3', name: 'Server Hosting (Annual)', description: 'Cloud server hosting per year', unit: 'year', rate: 24000, taxPercent: 18, hsn: '998315', category: 'Service', stock: 50, lowStockAlert: 5 },
  { id: 'prod_sample_4', name: 'Laptop - Dell Inspiron 15', description: 'Dell Inspiron 15 3000 series', unit: 'pcs', rate: 55000, taxPercent: 18, hsn: '8471', category: 'Product', stock: 12, lowStockAlert: 2 },
  { id: 'prod_sample_5', name: 'Office Chair Ergonomic', description: 'Premium ergonomic office chair', unit: 'pcs', rate: 8500, taxPercent: 18, hsn: '9401', category: 'Product', stock: 5, lowStockAlert: 1 },
];

function makeBill(id, invoiceNumber, invoiceDate, client, items, status, paidAmount, invoiceType = 'tax-invoice') {
  const subtotal = items.reduce((s, it) => s + it.quantity * it.rate * (1 - (it.discount || 0) / 100), 0);
  const taxAmount = items.reduce((s, it) => {
    const base = it.quantity * it.rate * (1 - (it.discount || 0) / 100);
    return s + (base * it.taxPercent) / 100;
  }, 0);
  const total = subtotal + taxAmount;
  const sameState = client.state === PROFILE.state;

  return {
    id,
    clientName: client.name,
    invoiceNumber,
    invoiceDate,
    invoiceType,
    currency: 'INR',
    totalAmount: total,
    totalTaxAmount: taxAmount,
    status,
    paidAmount: paidAmount || 0,
    payments: paidAmount > 0 ? [{ amount: paidAmount, date: invoiceDate, mode: 'bank-transfer', note: '' }] : [],
    data: {
      profile: PROFILE,
      client,
      details: { invoiceNumber, invoiceDate, dueDate: '', poNumber: '', placeOfSupply: client.state },
      items: items.map(it => ({
        ...it,
        amount: it.quantity * it.rate * (1 - (it.discount || 0) / 100),
        cgst: sameState ? (it.quantity * it.rate * it.taxPercent) / 200 : 0,
        sgst: sameState ? (it.quantity * it.rate * it.taxPercent) / 200 : 0,
        igst: !sameState ? (it.quantity * it.rate * it.taxPercent) / 100 : 0,
      })),
      totals: {
        subtotal,
        cgst: sameState ? taxAmount / 2 : 0,
        sgst: sameState ? taxAmount / 2 : 0,
        igst: !sameState ? taxAmount : 0,
        total,
        roundOff: 0,
        grandTotal: total,
      },
      invoiceType,
      customTerms: '1. Payment due within 15 days.\n2. Interest @ 18% p.a. on overdue payments.',
      customNotes: '',
      internalNote: '',
      extraSections: [],
      invoiceOptions: { currency: 'INR', showHsn: true, showQuantityUnit: true },
      taxInclusive: false,
    },
  };
}

const BILLS = [
  makeBill('INV/2026-27/0001', 'INV/2026-27/0001', '2026-04-05', CLIENTS[0],
    [{ name: 'Web Development Service', hsn: '998314', quantity: 1, rate: 50000, taxPercent: 18, discount: 0, unit: 'project' }],
    'paid', 59000),
  makeBill('INV/2026-27/0002', 'INV/2026-27/0002', '2026-04-15', CLIENTS[1],
    [{ name: 'Server Hosting (Annual)', hsn: '998315', quantity: 2, rate: 24000, taxPercent: 18, discount: 0, unit: 'year' }],
    'unpaid', 0),
  makeBill('INV/2026-27/0003', 'INV/2026-27/0003', '2026-04-22', CLIENTS[2],
    [
      { name: 'Laptop - Dell Inspiron 15', hsn: '8471', quantity: 2, rate: 55000, taxPercent: 18, discount: 5, unit: 'pcs' },
      { name: 'Office Chair Ergonomic', hsn: '9401', quantity: 3, rate: 8500, taxPercent: 18, discount: 0, unit: 'pcs' },
    ],
    'partial', 50000),
  makeBill('INV/2026-27/0004', 'INV/2026-27/0004', '2026-05-01', CLIENTS[0],
    [{ name: 'SEO Monthly Package', hsn: '998361', quantity: 3, rate: 15000, taxPercent: 18, discount: 0, unit: 'month' }],
    'overdue', 0),
  makeBill('PRO/2026-27/0001', 'PRO/2026-27/0001', '2026-05-10', CLIENTS[3],
    [{ name: 'Web Development Service', hsn: '998314', quantity: 1, rate: 75000, taxPercent: 0, discount: 0, unit: 'project' }],
    'unpaid', 0, 'proforma'),
];

const EXPENSES = [
  { id: 'exp_sample_1', date: '2026-04-03', description: 'Monthly office rent - April', category: 'Office Rent', amount: 45000, gstAmount: 0, gstPercent: 0, vendorName: 'DLF Properties', vendorGstin: '', invoiceNo: 'RENT-APR-26', paymentMode: 'Bank Transfer', note: '' },
  { id: 'exp_sample_2', date: '2026-04-07', description: 'Cloud server - AWS', category: 'Software & Tools', amount: 12500, gstAmount: 2250, gstPercent: 18, vendorName: 'Amazon Web Services', vendorGstin: '29AAAAC4175E1ZM', invoiceNo: 'AWS-APR-2026', paymentMode: 'Card', note: 'Monthly AWS bill' },
  { id: 'exp_sample_3', date: '2026-04-12', description: 'Google Workspace annual subscription', category: 'Software & Tools', amount: 8640, gstAmount: 1555, gstPercent: 18, vendorName: 'Google India Pvt Ltd', vendorGstin: '27AABCG1595D1Z5', invoiceNo: 'GWS-2026-APR', paymentMode: 'Card', note: '' },
  { id: 'exp_sample_4', date: '2026-04-18', description: 'Team lunch - client meeting', category: 'Meals & Entertainment', amount: 3200, gstAmount: 160, gstPercent: 5, vendorName: 'The Leela Hotel', vendorGstin: '06AAACT9876B1ZR', invoiceNo: 'TLH-2245', paymentMode: 'Card', note: '' },
  { id: 'exp_sample_5', date: '2026-05-02', description: 'Facebook Ads - May campaign', category: 'Marketing & Ads', amount: 20000, gstAmount: 3600, gstPercent: 18, vendorName: 'Meta Platforms', vendorGstin: '27AAFCM3592A1ZM', invoiceNo: 'FB-MAY-2026', paymentMode: 'Card', note: 'Lead generation campaign' },
];

const PURCHASES = [
  { id: 'pur_sample_1', date: '2026-04-08', supplierName: 'Dell India Pvt. Ltd.', supplierGstin: '29AAACG3592F1ZB', invoiceNumber: 'DELL-IN-45231', items: [{ name: 'Laptop Dell Inspiron 15', hsn: '8471', quantity: 5, rate: 42000, taxPercent: 18 }], paymentStatus: 'Paid', interstate: true, note: 'Resale stock purchase' },
  { id: 'pur_sample_2', date: '2026-04-20', supplierName: 'Office Furniture Hub', supplierGstin: '06AABCO7654H1ZP', invoiceNumber: 'OFH-1892', items: [{ name: 'Ergonomic Office Chair', hsn: '9401', quantity: 10, rate: 5500, taxPercent: 18 }], paymentStatus: 'Partial', interstate: false, note: '' },
  { id: 'pur_sample_3', date: '2026-05-05', supplierName: 'Reliance Jio Infocomm', supplierGstin: '27AARJA0822N1ZN', invoiceNumber: 'JIO-MAY26-GRG', items: [{ name: 'Leased Line Internet 200Mbps', hsn: '998425', quantity: 1, rate: 15000, taxPercent: 18 }], paymentStatus: 'Paid', interstate: true, note: 'Monthly internet bill' },
];

const RECEIPTS = [
  { id: 'rcp_sample_1', date: '2026-04-10', receiptNo: 'RCP/2026-27/0001', clientName: 'Sunrise Technologies Pvt. Ltd.', clientAddress: '12, Connaught Place, New Delhi 110001', amount: 59000, paymentMode: 'Bank Transfer', referenceNo: 'NEFT20260410123', againstInvoice: 'INV/2026-27/0001', note: 'Full payment received' },
  { id: 'rcp_sample_2', date: '2026-04-28', receiptNo: 'RCP/2026-27/0002', clientName: 'Apex Retail Solutions', clientAddress: '88, Brigade Road, Bengaluru', amount: 50000, paymentMode: 'UPI', referenceNo: 'UPI20260428XYZ', againstInvoice: 'INV/2026-27/0003', note: 'Advance payment' },
];

const RECURRING = [
  {
    id: 'rec_sample_1',
    clientName: 'Sunrise Technologies Pvt. Ltd.',
    clientState: 'Delhi',
    clientGstin: '07AAACS1234B1ZP',
    clientAddress: '12, Connaught Place, New Delhi',
    invoiceType: 'tax-invoice',
    frequency: 'monthly',
    nextDate: '2026-06-01',
    items: [{ name: 'SEO Monthly Package', hsn: '998361', quantity: 1, rate: 15000, taxPercent: 18, discount: 0, unit: 'month' }],
    customTerms: 'Payment due within 15 days.',
    customNotes: 'Auto-generated recurring invoice.',
  },
];

export default function SampleDataSeeder({ onDone }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState('');

  const seed = async () => {
    setLoading(true);
    try {
      setProgress('Saving business profile...');
      await saveProfile(PROFILE);

      setProgress('Saving clients...');
      for (const c of CLIENTS) await saveClient(c);

      setProgress('Saving products...');
      for (const p of PRODUCTS) await saveProduct(p);

      setProgress('Saving invoices...');
      for (const b of BILLS) await saveBill(b, false);

      setProgress('Saving expenses...');
      for (const e of EXPENSES) await saveExpense(e);

      setProgress('Saving purchase bills...');
      for (const p of PURCHASES) await savePurchase(p);

      setProgress('Saving receipts...');
      for (const r of RECEIPTS) await saveReceipt(r);

      setProgress('Saving recurring invoices...');
      for (const r of RECURRING) await saveRecurring(r);

      setProgress('Done!');
      setDone(true);
      toast('Sample data added successfully! Refresh the page to see it.', 'success');
      setTimeout(() => onDone?.(), 1500);
    } catch (err) {
      toast(`Failed: ${err.message}`, 'error');
      setProgress(`Error: ${err.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={!loading ? () => onDone?.() : undefined}>
      <div className="modal-content" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <Database size={24} color="var(--primary)" />
          <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Load Sample Data</h3>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
          This will add realistic sample data so you can explore all features:
        </p>

        <ul style={{ margin: '0 0 1.25rem 1.25rem', padding: 0, color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.8 }}>
          <li>Business profile (Technocratiq Digital)</li>
          <li>4 clients across India</li>
          <li>5 products &amp; services</li>
          <li>5 invoices (paid, unpaid, overdue, partial)</li>
          <li>5 expenses with GST</li>
          <li>3 purchase bills</li>
          <li>2 receipt vouchers</li>
          <li>1 recurring invoice</li>
        </ul>

        {progress && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.85rem', borderRadius: '8px', background: done ? 'var(--success-bg, #ecfdf5)' : 'var(--bg-secondary)', marginBottom: '1rem', fontSize: '0.85rem', color: done ? '#059669' : 'var(--text-secondary)' }}>
            {done ? <CheckCircle size={16} /> : <Loader size={16} className="spin" />}
            {progress}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          {!loading && !done && (
            <button className="btn btn-secondary" onClick={() => onDone?.()}>Cancel</button>
          )}
          {!done && (
            <button className="btn btn-primary" onClick={seed} disabled={loading}>
              {loading ? <><Loader size={15} className="spin" /> Loading...</> : <><Database size={15} /> Add Sample Data</>}
            </button>
          )}
          {done && (
            <button className="btn btn-primary" onClick={() => { onDone?.(); window.location.reload(); }}>
              <CheckCircle size={15} /> Refresh App
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
