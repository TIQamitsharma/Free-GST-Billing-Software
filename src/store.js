// Data layer — all operations go directly to Supabase using the authenticated client.
// RLS policies enforce per-user isolation automatically via the session JWT.

import { supabase } from './supabase';

// ---- Helpers ----

async function uid() {
  const { data } = await supabase.auth.getSession();
  const id = data?.session?.user?.id;
  if (!id) throw new Error('Not authenticated');
  return id;
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
  const userId = await uid();
  const { data } = await supabase
    .from('meta_store')
    .select('meta_value')
    .eq('user_id', userId)
    .eq('meta_key', 'invoiceNumberSettings')
    .maybeSingle();
  return { ...DEFAULT_INV_SETTINGS, ...(data?.meta_value || {}) };
};

export const saveInvoiceNumberSettings = async (settings) => {
  const userId = await uid();
  const { error } = await supabase.from('meta_store').upsert(
    { user_id: userId, meta_key: 'invoiceNumberSettings', meta_value: settings, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,meta_key' }
  );
  if (error) throw new Error(error.message);
};

// ---- Invoice Display Options ----
export const getInvoiceDisplayOptions = async () => {
  const userId = await uid();
  const { data } = await supabase
    .from('meta_store')
    .select('meta_value')
    .eq('user_id', userId)
    .eq('meta_key', 'invoiceDisplayOptions')
    .maybeSingle();
  return data?.meta_value ?? null;
};

export const saveInvoiceDisplayOptions = async (options) => {
  const userId = await uid();
  const { error } = await supabase.from('meta_store').upsert(
    { user_id: userId, meta_key: 'invoiceDisplayOptions', meta_value: options, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,meta_key' }
  );
  if (error) throw new Error(error.message);
};

// ---- Region preference ----
const REGION_KEY = 'gst_regionMode';
export const getRegionMode = () => {
  try { return localStorage.getItem(REGION_KEY) || 'both'; } catch { return 'both'; }
};
export const setRegionMode = (mode) => {
  if (!['india', 'international', 'both'].includes(mode)) return;
  try { localStorage.setItem(REGION_KEY, mode); } catch { /* ignore */ }
  uid().then(userId =>
    supabase.from('meta_store').upsert(
      { user_id: userId, meta_key: 'regionMode', meta_value: mode, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,meta_key' }
    )
  ).catch(() => {});
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
  uid().then(userId =>
    supabase.from('meta_store').upsert(
      { user_id: userId, meta_key: 'enabledModules', meta_value: map || {}, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,meta_key' }
    )
  ).catch(() => {});
};

// ---- Invoice counter ----
export const getNextInvoiceNumber = async (prefix = 'INV') => {
  const settings = await getInvoiceNumberSettings();
  const key = `counter_${prefix}`;
  const userId = await uid();

  const { data: existing } = await supabase
    .from('meta_store')
    .select('meta_value')
    .eq('user_id', userId)
    .eq('meta_key', key)
    .maybeSingle();

  const next = ((existing?.meta_value) || 0) + 1;
  const { error } = await supabase.from('meta_store').upsert(
    { user_id: userId, meta_key: key, meta_value: next, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,meta_key' }
  );
  if (error) throw new Error(error.message);

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
  const userId = await uid();

  // Strip internal transport flag before storing
  const { _isUpdate, ...billToSave } = bill;

  if (!billToSave.id) throw new Error('Bill must have an id');

  const { error } = await supabase.from('bills').upsert(
    {
      user_id: userId,
      bill_id: billToSave.id,
      data: billToSave,
      invoice_date: billToSave.invoiceDate || null,
      invoice_type: billToSave.invoiceType || 'tax-invoice',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,bill_id' }
  );
  if (error) throw new Error(error.message);

  if (!isUpdate) {
    await incrementMonthlyUsage(userId).catch(() => {});
  }

  return { success: true };
};

export const getAllBills = async () => {
  const userId = await uid();
  const { data, error } = await supabase
    .from('bills')
    .select('data, invoice_date')
    .eq('user_id', userId)
    .order('invoice_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(r => r.data);
};

export const deleteBill = async (id) => {
  const userId = await uid();
  const { error } = await supabase
    .from('bills')
    .delete()
    .eq('user_id', userId)
    .eq('bill_id', id);
  if (error) throw new Error(error.message);
  return { success: true };
};

// ---- Monthly usage tracking ----
async function incrementMonthlyUsage(userId) {
  const yearMonth = new Date().toISOString().slice(0, 7);
  const { data: existing } = await supabase
    .from('usage_tracking')
    .select('invoice_count')
    .eq('user_id', userId)
    .eq('year_month', yearMonth)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('usage_tracking')
      .update({ invoice_count: (existing.invoice_count || 0) + 1, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('year_month', yearMonth);
  } else {
    await supabase
      .from('usage_tracking')
      .insert({ user_id: userId, year_month: yearMonth, invoice_count: 1 });
  }
}

// ---- Profile helpers ----
function mapProfileFromDb(row) {
  const e = row.extra || {};
  return {
    id: row.id,
    businessName: row.business_name,
    address: row.address,
    city: row.city,
    pin: row.pin,
    state: row.state,
    country: row.country,
    gstin: row.gstin,
    pan: row.pan,
    email: row.email,
    phone: row.phone,
    bankName: row.bank_name,
    accountNumber: row.account_number,
    ifsc: row.ifsc,
    upiId: row.upi_id,
    logo: row.logo,
    signature: row.signature,
    googleClientId: e.googleClientId || '',
    googleDriveFolder: row.google_drive_folder,
    ...e,
  };
}

function buildDbProfile(profile, userId, isActive) {
  const { businessName, address, city, pin, state, country, gstin, pan, email,
    phone, bankName, accountNumber, ifsc, upiId, logo, signature,
    googleClientId, googleDriveFolder, id, ...extra } = profile;
  return {
    user_id: userId,
    business_name: businessName || '',
    address: address || '',
    city: city || '',
    pin: pin || '',
    state: state || '',
    country: country || 'India',
    gstin: gstin || '',
    pan: pan || '',
    email: email || '',
    phone: phone || '',
    bank_name: bankName || '',
    account_number: accountNumber || '',
    ifsc: ifsc || '',
    upi_id: upiId || '',
    logo: logo || '',
    signature: signature || '',
    google_drive_folder: googleDriveFolder || 'GST Billing Invoices',
    is_active: isActive,
    extra: { googleClientId: googleClientId || '', ...extra },
    updated_at: new Date().toISOString(),
  };
}

// ---- Profile ----
export const saveProfile = async (profile) => {
  const userId = await uid();

  await supabase.from('business_profiles').update({ is_active: false }).eq('user_id', userId);

  const dbProfile = buildDbProfile(profile, userId, true);
  let savedId = profile.id;

  if (savedId) {
    const { error } = await supabase
      .from('business_profiles')
      .update(dbProfile)
      .eq('id', savedId)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from('business_profiles')
      .insert(dbProfile)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(error.message);
    savedId = data?.id;
  }

  return { success: true, id: savedId };
};

export const getProfile = async () => {
  const userId = await uid();
  const { data } = await supabase
    .from('business_profiles')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (data) return mapProfileFromDb(data);

  const { data: first } = await supabase
    .from('business_profiles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return first ? mapProfileFromDb(first) : {
    businessName: '', address: '', state: '', gstin: '', pan: '',
    email: '', phone: '', bankName: '', accountNumber: '', ifsc: '',
    logo: '', signature: '', upiId: '', googleClientId: '', googleDriveFolder: 'GST Billing Invoices',
  };
};

// ---- Business Profiles (multi-business) ----
export const getAllProfiles = async () => {
  const userId = await uid();
  const { data, error } = await supabase
    .from('business_profiles')
    .select('*')
    .eq('user_id', userId)
    .order('business_name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(mapProfileFromDb);
};

export const saveBusinessProfile = async (profile) => {
  const userId = await uid();
  const dbProfile = buildDbProfile(profile, userId, false);
  let savedId = profile.id;

  if (savedId) {
    const { error } = await supabase
      .from('business_profiles')
      .update(dbProfile)
      .eq('id', savedId)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from('business_profiles')
      .insert(dbProfile)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(error.message);
    savedId = data?.id;
  }

  return { success: true, id: savedId };
};

export const deleteBusinessProfile = async (id) => {
  const userId = await uid();
  const { error } = await supabase
    .from('business_profiles')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw new Error(error.message);
  return { success: true };
};

// ---- Clients ----
export const saveClient = async (client) => {
  const userId = await uid();
  if (!client.id) client.id = 'cli_' + Date.now();
  const { error } = await supabase.from('clients').upsert(
    { user_id: userId, client_id: client.id, data: client, name: client.name || '', updated_at: new Date().toISOString() },
    { onConflict: 'user_id,client_id' }
  );
  if (error) throw new Error(error.message);
  return { success: true, id: client.id };
};

export const getAllClients = async () => {
  const userId = await uid();
  const { data, error } = await supabase
    .from('clients')
    .select('data')
    .eq('user_id', userId)
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(r => r.data);
};

export const deleteClient = async (id) => {
  const userId = await uid();
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('user_id', userId)
    .eq('client_id', id);
  if (error) throw new Error(error.message);
  return { success: true };
};

// ---- Terms Templates ----
const DEFAULT_TEMPLATE = {
  id: 'default',
  name: 'Standard Terms',
  content: '1. Payment is due within 15 days of invoice date unless otherwise agreed in writing.\n2. Interest @ 18% p.a. will be charged on overdue payments beyond the due date.\n3. The scope of work is limited to what is explicitly mentioned in the project proposal/agreement. Any additional requirements will be quoted and billed separately.\n4. All intellectual property and source code will be transferred to the client only upon receipt of full payment.\n5. We shall not be liable for any delays caused by incomplete or late submission of content, credentials, or approvals from the client\'s end.\n6. Any change requests after project approval may attract additional charges and revised timelines.\n7. This invoice is subject to the jurisdiction of courts at the service provider\'s registered location.\n8. E. & O.E.',
};

export const getTermsTemplates = async () => {
  const userId = await uid();
  const { data } = await supabase
    .from('terms_templates')
    .select('data')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  let templates = (data || []).map(r => r.data);
  if (templates.length === 0) {
    await supabase.from('terms_templates').insert({
      user_id: userId,
      template_id: 'default',
      data: DEFAULT_TEMPLATE,
      name: 'Standard Terms',
    });
    templates = [DEFAULT_TEMPLATE];
  }
  return templates;
};

export const saveTermsTemplate = async (template) => {
  const userId = await uid();
  if (!template.id) template.id = 'tpl_' + Date.now();
  const { error } = await supabase.from('terms_templates').upsert(
    { user_id: userId, template_id: template.id, data: template, name: template.name || '', updated_at: new Date().toISOString() },
    { onConflict: 'user_id,template_id' }
  );
  if (error) throw new Error(error.message);
  return { success: true, id: template.id };
};

export const deleteTermsTemplate = async (id) => {
  const userId = await uid();
  const { error } = await supabase
    .from('terms_templates')
    .delete()
    .eq('user_id', userId)
    .eq('template_id', id);
  if (error) throw new Error(error.message);
  return { success: true };
};

// ---- Products / Inventory ----
export const getAllProducts = async () => {
  const userId = await uid();
  const { data, error } = await supabase
    .from('products')
    .select('data')
    .eq('user_id', userId)
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(r => r.data);
};

export const saveProduct = async (product) => {
  const userId = await uid();
  if (!product.id) product.id = 'prod_' + Date.now();
  const { error } = await supabase.from('products').upsert(
    { user_id: userId, product_id: product.id, data: product, name: product.name || '', updated_at: new Date().toISOString() },
    { onConflict: 'user_id,product_id' }
  );
  if (error) throw new Error(error.message);
  return { success: true, id: product.id };
};

export const deleteProduct = async (id) => {
  const userId = await uid();
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', id);
  if (error) throw new Error(error.message);
  return { success: true };
};

// ---- Expenses ----
export const getAllExpenses = async () => {
  const userId = await uid();
  const { data, error } = await supabase
    .from('expenses')
    .select('data')
    .eq('user_id', userId)
    .order('expense_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(r => r.data);
};

export const saveExpense = async (expense) => {
  const userId = await uid();
  if (!expense.id) expense.id = 'exp_' + Date.now();
  const { error } = await supabase.from('expenses').upsert(
    { user_id: userId, expense_id: expense.id, data: expense, expense_date: expense.date || null, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,expense_id' }
  );
  if (error) throw new Error(error.message);
  return { success: true, id: expense.id };
};

export const deleteExpense = async (id) => {
  const userId = await uid();
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('user_id', userId)
    .eq('expense_id', id);
  if (error) throw new Error(error.message);
  return { success: true };
};

// ---- Purchases ----
export const getAllPurchases = async () => {
  const userId = await uid();
  const { data, error } = await supabase
    .from('purchases')
    .select('data')
    .eq('user_id', userId)
    .order('purchase_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(r => r.data);
};

export const savePurchase = async (purchase) => {
  const userId = await uid();
  if (!purchase.id) purchase.id = 'pur_' + Date.now();
  const { error } = await supabase.from('purchases').upsert(
    { user_id: userId, purchase_id: purchase.id, data: purchase, purchase_date: purchase.date || null, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,purchase_id' }
  );
  if (error) throw new Error(error.message);
  return { success: true, id: purchase.id };
};

export const deletePurchase = async (id) => {
  const userId = await uid();
  const { error } = await supabase
    .from('purchases')
    .delete()
    .eq('user_id', userId)
    .eq('purchase_id', id);
  if (error) throw new Error(error.message);
  return { success: true };
};

// ---- Recurring Invoices ----
export const getAllRecurring = async () => {
  const userId = await uid();
  const { data, error } = await supabase
    .from('recurring_invoices')
    .select('data')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(r => r.data);
};

export const saveRecurring = async (item) => {
  const userId = await uid();
  if (!item.id) item.id = 'rec_' + Date.now();
  const { error } = await supabase.from('recurring_invoices').upsert(
    { user_id: userId, recurring_id: item.id, data: item, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,recurring_id' }
  );
  if (error) throw new Error(error.message);
  return { success: true, id: item.id };
};

export const deleteRecurring = async (id) => {
  const userId = await uid();
  const { error } = await supabase
    .from('recurring_invoices')
    .delete()
    .eq('user_id', userId)
    .eq('recurring_id', id);
  if (error) throw new Error(error.message);
  return { success: true };
};

// ---- Receipts / Payment Vouchers ----
export const getAllReceipts = async () => {
  const userId = await uid();
  const { data, error } = await supabase
    .from('receipts')
    .select('data')
    .eq('user_id', userId)
    .order('receipt_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(r => r.data);
};

export const saveReceipt = async (receipt) => {
  const userId = await uid();
  if (!receipt.id) receipt.id = 'rcp_' + Date.now();
  const { error } = await supabase.from('receipts').upsert(
    { user_id: userId, receipt_id: receipt.id, data: receipt, receipt_date: receipt.date || null, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,receipt_id' }
  );
  if (error) throw new Error(error.message);
  return { success: true, id: receipt.id };
};

export const deleteReceipt = async (id) => {
  const userId = await uid();
  const { error } = await supabase
    .from('receipts')
    .delete()
    .eq('user_id', userId)
    .eq('receipt_id', id);
  if (error) throw new Error(error.message);
  return { success: true };
};

// ---- Usage / Plan Info ----
export const getUsage = async () => {
  const userId = await uid();
  const yearMonth = new Date().toISOString().slice(0, 7);

  const [usageRes, profileRes] = await Promise.all([
    supabase.from('usage_tracking').select('invoice_count').eq('user_id', userId).eq('year_month', yearMonth).maybeSingle(),
    supabase.from('user_profiles').select('plan').eq('id', userId).maybeSingle(),
  ]);

  const plan = profileRes.data?.plan || 'free';
  return {
    plan,
    invoicesThisMonth: usageRes.data?.invoice_count || 0,
    limit: plan === 'pro' ? null : 10,
    yearMonth,
  };
};

// ---- GST Credentials (Pro only) ----
export const getGstCredentials = async () => {
  const userId = await uid();
  const { data, error } = await supabase
    .from('gst_credentials')
    .select('gstin, username, app_key, notes, created_at, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
};

export const saveGstCredentials = async (creds) => {
  const userId = await uid();
  const { gstin, username, password, appKey, notes } = creds;
  if (!gstin || !username) throw new Error('GSTIN and username are required');
  const record = { user_id: userId, gstin, username, app_key: appKey || '', notes: notes || '', updated_at: new Date().toISOString() };
  if (password) record.password_encrypted = password;
  const { error } = await supabase.from('gst_credentials').upsert(record, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
  return { success: true };
};

export const deleteGstCredentials = async () => {
  const userId = await uid();
  const { error } = await supabase.from('gst_credentials').delete().eq('user_id', userId);
  if (error) throw new Error(error.message);
  return { success: true };
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
  const userId = await uid();
  const sel = selection || { profile: true, profiles: true, bills: true, clients: true, products: true, expenses: true, purchases: true, recurring: true, receipts: true, termsTemplates: true, meta: true, localStorage: true };

  const [billsRes, profileRes, clientsRes, templatesRes, productsRes, expensesRes,
    recurringRes, receiptsRes, profilesRes, purchasesRes, metaRes] = await Promise.all([
    supabase.from('bills').select('data').eq('user_id', userId),
    supabase.from('business_profiles').select('*').eq('user_id', userId).eq('is_active', true).maybeSingle(),
    supabase.from('clients').select('data').eq('user_id', userId),
    supabase.from('terms_templates').select('data').eq('user_id', userId),
    supabase.from('products').select('data').eq('user_id', userId),
    supabase.from('expenses').select('data').eq('user_id', userId),
    supabase.from('recurring_invoices').select('data').eq('user_id', userId),
    supabase.from('receipts').select('data').eq('user_id', userId),
    supabase.from('business_profiles').select('*').eq('user_id', userId),
    supabase.from('purchases').select('data').eq('user_id', userId),
    supabase.from('meta_store').select('meta_key,meta_value').eq('user_id', userId),
  ]);

  const out = { exportedAt: new Date().toISOString(), version: '2.0.0', __freegstbill_backup: true };
  if (sel.bills)          out.bills = (billsRes.data || []).map(r => r.data);
  if (sel.profile)        out.profile = profileRes.data ? mapProfileFromDb(profileRes.data) : null;
  if (sel.clients)        out.clients = (clientsRes.data || []).map(r => r.data);
  if (sel.termsTemplates) out.termsTemplates = (templatesRes.data || []).map(r => r.data);
  if (sel.products)       out.products = (productsRes.data || []).map(r => r.data);
  if (sel.expenses)       out.expenses = (expensesRes.data || []).map(r => r.data);
  if (sel.recurring)      out.recurring = (recurringRes.data || []).map(r => r.data);
  if (sel.receipts)       out.receipts = (receiptsRes.data || []).map(r => r.data);
  if (sel.profiles)       out.profiles = (profilesRes.data || []).map(mapProfileFromDb);
  if (sel.purchases)      out.purchases = (purchasesRes.data || []).map(r => r.data);
  if (sel.meta)           out.meta = Object.fromEntries((metaRes.data || []).map(x => [x.meta_key, x.meta_value]));
  if (sel.localStorage)   out.localStorage = collectLocalStorage();

  return JSON.stringify(out, null, 2);
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
  const userId = await uid();
  const inspected = typeof jsonString === 'string' ? inspectBackup(jsonString) : { raw: jsonString };
  const data = inspected.raw;
  const sel = selection || { profile: true, profiles: true, bills: true, clients: true, products: true, expenses: true, purchases: true, recurring: true, receipts: true, termsTemplates: true, meta: true, localStorage: true };

  let billCount = 0, clientCount = 0, templateCount = 0, productCount = 0;

  if (sel.bills && data.bills) for (const bill of data.bills) {
    if (bill.id) {
      const { _isUpdate, ...billToSave } = bill;
      await supabase.from('bills').upsert({ user_id: userId, bill_id: bill.id, data: billToSave, invoice_date: bill.invoiceDate || null, invoice_type: bill.invoiceType || 'tax-invoice' }, { onConflict: 'user_id,bill_id' });
      billCount++;
    }
  }
  if (sel.clients && data.clients) for (const cli of data.clients) {
    if (cli.id) { await supabase.from('clients').upsert({ user_id: userId, client_id: cli.id, data: cli, name: cli.name || '' }, { onConflict: 'user_id,client_id' }); clientCount++; }
  }
  if (sel.termsTemplates && data.termsTemplates) for (const tpl of data.termsTemplates) {
    if (tpl.id) { await supabase.from('terms_templates').upsert({ user_id: userId, template_id: tpl.id, data: tpl, name: tpl.name || '' }, { onConflict: 'user_id,template_id' }); templateCount++; }
  }
  if (sel.products && data.products) for (const prod of data.products) {
    if (prod.id) { await supabase.from('products').upsert({ user_id: userId, product_id: prod.id, data: prod, name: prod.name || '' }, { onConflict: 'user_id,product_id' }); productCount++; }
  }
  if (sel.expenses && data.expenses) for (const exp of data.expenses) {
    if (exp.id) await supabase.from('expenses').upsert({ user_id: userId, expense_id: exp.id, data: exp, expense_date: exp.date || null }, { onConflict: 'user_id,expense_id' });
  }
  if (sel.recurring && data.recurring) for (const rec of data.recurring) {
    if (rec.id) await supabase.from('recurring_invoices').upsert({ user_id: userId, recurring_id: rec.id, data: rec }, { onConflict: 'user_id,recurring_id' });
  }
  if (sel.receipts && data.receipts) for (const rcp of data.receipts) {
    if (rcp.id) await supabase.from('receipts').upsert({ user_id: userId, receipt_id: rcp.id, data: rcp, receipt_date: rcp.date || null }, { onConflict: 'user_id,receipt_id' });
  }
  if (sel.purchases && data.purchases) for (const pur of data.purchases) {
    if (pur.id) await supabase.from('purchases').upsert({ user_id: userId, purchase_id: pur.id, data: pur, purchase_date: pur.date || null }, { onConflict: 'user_id,purchase_id' });
  }
  if (sel.profile && data.profile) await saveProfile(data.profile);
  if (sel.meta && data.meta) for (const [key, value] of Object.entries(data.meta)) {
    await supabase.from('meta_store').upsert({ user_id: userId, meta_key: key, meta_value: value }, { onConflict: 'user_id,meta_key' });
  }
  if (sel.localStorage && data.localStorage) restoreLocalStorage(data.localStorage);

  return { billCount, clientCount, templateCount, productCount, hasProfile: !!data.profile };
};
