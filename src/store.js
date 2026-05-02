// API client layer — all calls include the Supabase JWT in Authorization header.
// The token is read from the active Supabase session on each request.

import { supabase } from './supabase';

const API = '/api';

async function getAuthHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}` };
}

async function apiFetch(url, options = {}) {
  const authHeader = await getAuthHeader();
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.message || body.error || `API error: ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.json();
}

// ---- Invoice Number Settings ----
const DEFAULT_INV_SETTINGS = {
  format: 'branded',
  brandPrefix: '',
  separator: '/',
  showFinYear: true,
  startNumber: 1,
  padDigits: 4,
};

export const getInvoiceNumberSettings = async () => {
  const { value } = await apiFetch(`${API}/meta/invoiceNumberSettings`);
  return { ...DEFAULT_INV_SETTINGS, ...(value || {}) };
};

export const saveInvoiceNumberSettings = async (settings) => {
  await apiFetch(`${API}/meta/invoiceNumberSettings`, {
    method: 'POST',
    body: JSON.stringify({ value: settings }),
  });
};

// ---- Invoice Display Options ----
export const getInvoiceDisplayOptions = async () => {
  const { value } = await apiFetch(`${API}/meta/invoiceDisplayOptions`);
  return value || null;
};

export const saveInvoiceDisplayOptions = async (options) => {
  await apiFetch(`${API}/meta/invoiceDisplayOptions`, {
    method: 'POST',
    body: JSON.stringify({ value: options }),
  });
};

// ---- Region preference ----
const REGION_KEY = 'gst_regionMode';
export const getRegionMode = () => {
  try { return localStorage.getItem(REGION_KEY) || 'both'; } catch { return 'both'; }
};
export const setRegionMode = (mode) => {
  if (!['india', 'international', 'both'].includes(mode)) return;
  try { localStorage.setItem(REGION_KEY, mode); } catch { /* ignore */ }
  apiFetch(`${API}/meta/regionMode`, { method: 'POST', body: JSON.stringify({ value: mode }) }).catch(() => {});
};

// ---- Enabled feature modules ----
const MODULES_KEY = 'gst_enabledModules';
export const getEnabledModules = () => {
  try {
    const raw = localStorage.getItem(MODULES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};
export const setEnabledModules = (map) => {
  try { localStorage.setItem(MODULES_KEY, JSON.stringify(map || {})); } catch { /* ignore */ }
  apiFetch(`${API}/meta/enabledModules`, { method: 'POST', body: JSON.stringify({ value: map || {} }) }).catch(() => {});
};

// ---- Invoice counter ----
export const getNextInvoiceNumber = async (prefix = 'INV') => {
  const settings = await getInvoiceNumberSettings();
  const key = `counter_${prefix}`;
  const { value: next } = await apiFetch(`${API}/meta/${key}/increment`, { method: 'POST', body: JSON.stringify({}) });

  if (settings.format === 'random') {
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    const pfx = settings.brandPrefix || prefix;
    return `${pfx}${settings.separator}${rand}`;
  }

  const sep = settings.separator || '/';
  const pfx = settings.brandPrefix || prefix;
  const padded = String(next).padStart(settings.padDigits || 4, '0');

  if (settings.showFinYear) {
    const currentYear = new Date().getFullYear();
    const nextYear = (currentYear + 1).toString().slice(-2);
    return `${pfx}${sep}${currentYear}-${nextYear}${sep}${padded}`;
  }

  return `${pfx}${sep}${padded}`;
};

// ---- Bills ----
export const saveBill = async (bill, isUpdate = false) => {
  return apiFetch(`${API}/bills`, {
    method: 'POST',
    body: JSON.stringify({ ...bill, _isUpdate: isUpdate }),
  });
};

export const getAllBills = async () => {
  return apiFetch(`${API}/bills`);
};

export const deleteBill = async (id) => {
  return apiFetch(`${API}/bills/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

// ---- Profile ----
export const saveProfile = async (profile) => {
  return apiFetch(`${API}/profile`, { method: 'POST', body: JSON.stringify(profile) });
};

export const getProfile = async () => {
  return apiFetch(`${API}/profile`);
};

// ---- Saved Clients ----
export const saveClient = async (client) => {
  const res = await apiFetch(`${API}/clients`, { method: 'POST', body: JSON.stringify(client) });
  if (res.id) client.id = res.id;
  return client;
};

export const getAllClients = async () => {
  return apiFetch(`${API}/clients`);
};

export const deleteClient = async (id) => {
  return apiFetch(`${API}/clients/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

// ---- Terms Templates ----
export const getTermsTemplates = async () => {
  return apiFetch(`${API}/templates`);
};

export const saveTermsTemplate = async (template) => {
  const res = await apiFetch(`${API}/templates`, { method: 'POST', body: JSON.stringify(template) });
  if (res.id) template.id = res.id;
  return template;
};

export const deleteTermsTemplate = async (id) => {
  return apiFetch(`${API}/templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

// ---- Products / Inventory ----
export const getAllProducts = async () => {
  return apiFetch(`${API}/products`);
};

export const saveProduct = async (product) => {
  const res = await apiFetch(`${API}/products`, { method: 'POST', body: JSON.stringify(product) });
  if (res.id) product.id = res.id;
  return product;
};

export const deleteProduct = async (id) => {
  return apiFetch(`${API}/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

// ---- Expenses ----
export const getAllExpenses = async () => {
  return apiFetch(`${API}/expenses`);
};

export const saveExpense = async (expense) => {
  const res = await apiFetch(`${API}/expenses`, { method: 'POST', body: JSON.stringify(expense) });
  if (res.id) expense.id = res.id;
  return expense;
};

export const deleteExpense = async (id) => {
  return apiFetch(`${API}/expenses/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

// ---- Purchases ----
export const getAllPurchases = async () => {
  return apiFetch(`${API}/purchases`);
};

export const savePurchase = async (purchase) => {
  const res = await apiFetch(`${API}/purchases`, { method: 'POST', body: JSON.stringify(purchase) });
  if (res.id) purchase.id = res.id;
  return purchase;
};

export const deletePurchase = async (id) => {
  return apiFetch(`${API}/purchases/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

// ---- Recurring Invoices ----
export const getAllRecurring = async () => {
  return apiFetch(`${API}/recurring`);
};

export const saveRecurring = async (item) => {
  const res = await apiFetch(`${API}/recurring`, { method: 'POST', body: JSON.stringify(item) });
  if (res.id) item.id = res.id;
  return item;
};

export const deleteRecurring = async (id) => {
  return apiFetch(`${API}/recurring/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

// ---- Receipts / Payment Vouchers ----
export const getAllReceipts = async () => {
  return apiFetch(`${API}/receipts`);
};

export const saveReceipt = async (receipt) => {
  const res = await apiFetch(`${API}/receipts`, { method: 'POST', body: JSON.stringify(receipt) });
  if (res.id) receipt.id = res.id;
  return receipt;
};

export const deleteReceipt = async (id) => {
  return apiFetch(`${API}/receipts/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

// ---- Business Profiles (multi-business) ----
export const getAllProfiles = async () => {
  return apiFetch(`${API}/profiles`);
};

export const saveBusinessProfile = async (profile) => {
  const res = await apiFetch(`${API}/profiles`, { method: 'POST', body: JSON.stringify(profile) });
  if (res.id) profile.id = res.id;
  return profile;
};

export const deleteBusinessProfile = async (id) => {
  return apiFetch(`${API}/profiles/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

// ---- Usage / Plan ----
export const getUsage = async () => {
  return apiFetch(`${API}/usage`);
};

// ---- GST Credentials (Pro only) ----
export const getGstCredentials = async () => {
  return apiFetch(`${API}/gst-credentials`);
};

export const saveGstCredentials = async (creds) => {
  return apiFetch(`${API}/gst-credentials`, { method: 'POST', body: JSON.stringify(creds) });
};

export const deleteGstCredentials = async () => {
  return apiFetch(`${API}/gst-credentials`, { method: 'DELETE' });
};

// ---- Export / Import ----
const EXPORTABLE_LOCALSTORAGE_KEYS = [
  'gst_customUnits',
  'gst_regionMode',
  'gst_enabledModules',
  'freegstbill_invoiceOptions',
  'theme',
  'freegstbill_onboarded',
];

const collectLocalStorage = () => {
  const out = {};
  EXPORTABLE_LOCALSTORAGE_KEYS.forEach(k => {
    try { const v = localStorage.getItem(k); if (v !== null) out[k] = v; } catch { /* sandboxed */ }
  });
  return out;
};

const restoreLocalStorage = (map) => {
  if (!map || typeof map !== 'object') return;
  Object.entries(map).forEach(([k, v]) => {
    if (!EXPORTABLE_LOCALSTORAGE_KEYS.includes(k)) return;
    try { localStorage.setItem(k, v); } catch { /* ignore */ }
  });
};

export const exportAllData = async (selection) => {
  const all = await apiFetch(`${API}/export`);
  const sel = selection || { profile: true, profiles: true, bills: true, clients: true, products: true, expenses: true, purchases: true, recurring: true, receipts: true, termsTemplates: true, meta: true, localStorage: true };

  const data = { exportedAt: new Date().toISOString(), version: '2.0.0', __freegstbill_backup: true };
  if (sel.profile)        data.profile = all.profile;
  if (sel.profiles)       data.profiles = all.profiles;
  if (sel.bills)          data.bills = all.bills;
  if (sel.clients)        data.clients = all.clients;
  if (sel.termsTemplates) data.termsTemplates = all.termsTemplates;
  if (sel.products)       data.products = all.products;
  if (sel.expenses)       data.expenses = all.expenses;
  if (sel.recurring)      data.recurring = all.recurring;
  if (sel.receipts)       data.receipts = all.receipts;
  if (sel.purchases)      data.purchases = all.purchases;
  if (sel.meta)           data.meta = all.meta;
  if (sel.localStorage)   data.localStorage = collectLocalStorage();

  return JSON.stringify(data, null, 2);
};

export const inspectBackup = (jsonString) => {
  let data;
  try { data = JSON.parse(jsonString); }
  catch { throw new Error('Not a valid JSON file'); }
  return {
    valid: !!data && (data.__freegstbill_backup || data.bills || data.profile),
    exportedAt: data.exportedAt || null,
    version: data.version || null,
    counts: {
      profile: data.profile && Object.keys(data.profile).length > 0 ? 1 : 0,
      profiles: Array.isArray(data.profiles) ? data.profiles.length : 0,
      bills: Array.isArray(data.bills) ? data.bills.length : 0,
      clients: Array.isArray(data.clients) ? data.clients.length : 0,
      termsTemplates: Array.isArray(data.termsTemplates) ? data.termsTemplates.length : 0,
      products: Array.isArray(data.products) ? data.products.length : 0,
      expenses: Array.isArray(data.expenses) ? data.expenses.length : 0,
      purchases: Array.isArray(data.purchases) ? data.purchases.length : 0,
      recurring: Array.isArray(data.recurring) ? data.recurring.length : 0,
      receipts: Array.isArray(data.receipts) ? data.receipts.length : 0,
      meta: data.meta ? Object.keys(data.meta).length : 0,
      localStorage: data.localStorage ? Object.keys(data.localStorage).length : 0,
    },
    raw: data,
  };
};

export const importData = async (jsonString, selection) => {
  const inspected = typeof jsonString === 'string' ? inspectBackup(jsonString) : { raw: jsonString };
  const data = inspected.raw;
  const sel = selection || { profile: true, profiles: true, bills: true, clients: true, products: true, expenses: true, purchases: true, recurring: true, receipts: true, termsTemplates: true, meta: true, localStorage: true };

  const payload = {};
  if (sel.profile && data.profile)               payload.profile = data.profile;
  if (sel.profiles && data.profiles)             payload.profiles = data.profiles;
  if (sel.bills && data.bills)                   payload.bills = data.bills;
  if (sel.clients && data.clients)               payload.clients = data.clients;
  if (sel.termsTemplates && data.termsTemplates) payload.termsTemplates = data.termsTemplates;
  if (sel.products && data.products)             payload.products = data.products;
  if (sel.expenses && data.expenses)             payload.expenses = data.expenses;
  if (sel.recurring && data.recurring)           payload.recurring = data.recurring;
  if (sel.receipts && data.receipts)             payload.receipts = data.receipts;
  if (sel.purchases && data.purchases)           payload.purchases = data.purchases;
  if (sel.meta && data.meta)                     payload.meta = data.meta;

  const result = await apiFetch(`${API}/import`, { method: 'POST', body: JSON.stringify(payload) });
  if (sel.localStorage && data.localStorage) restoreLocalStorage(data.localStorage);
  return result;
};
