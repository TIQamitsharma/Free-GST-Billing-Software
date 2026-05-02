import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// Load .env if dotenv is available (dev convenience)
try {
  const { config } = await import('dotenv');
  config();
} catch { /* dotenv not installed — rely on process.env */ }

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 3001;

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || (!SUPABASE_SERVICE_ROLE_KEY && !SUPABASE_ANON_KEY)) {
  console.error('ERROR: Missing Supabase environment variables. Copy .env.example to .env and fill in values.');
  process.exit(1);
}

// Admin client for auth verification and usage tracking (uses service role when available)
const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Returns a user-scoped Supabase client for data operations.
// When service role key is available, admin client is used (RLS bypassed, user_id filters enforced in code).
// When only anon key is available, user's JWT is forwarded so RLS enforces isolation automatically.
function getDb(req) {
  if (SUPABASE_SERVICE_ROLE_KEY) return supabaseAdmin;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${req._token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.slice(7);
  req._token = token;
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' });
    req.userId = user.id;
    req.userEmail = user.email;

    const { data: profile } = await getDb(req)
      .from('user_profiles')
      .select('plan')
      .eq('id', user.id)
      .maybeSingle();
    req.userPlan = profile?.plan || 'free';
    next();
  } catch {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

// ============================================================
// FREE TIER INVOICE LIMIT MIDDLEWARE
// ============================================================
async function checkInvoiceLimit(req, res, next) {
  if (req.userPlan === 'pro') return next();

  const FREE_LIMIT = 10;
  const yearMonth = new Date().toISOString().slice(0, 7);

  const { data } = await getDb(req)
    .from('usage_tracking')
    .select('invoice_count')
    .eq('user_id', req.userId)
    .eq('year_month', yearMonth)
    .maybeSingle();

  const count = data?.invoice_count || 0;
  const isNewBill = !req.body._isUpdate;

  if (isNewBill && count >= FREE_LIMIT) {
    return res.status(402).json({
      error: 'invoice_limit_reached',
      message: `Free plan allows ${FREE_LIMIT} invoices per month. Upgrade to Pro for unlimited invoices.`,
      used: count,
      limit: FREE_LIMIT,
    });
  }

  req.isNewBill = isNewBill;
  next();
}

// Increment monthly invoice usage count (uses admin for reliability)
async function incrementUsage(userId) {
  const yearMonth = new Date().toISOString().slice(0, 7);
  const db = supabaseAdmin;

  const { data: existing } = await db
    .from('usage_tracking')
    .select('invoice_count')
    .eq('user_id', userId)
    .eq('year_month', yearMonth)
    .maybeSingle();

  if (existing) {
    await db
      .from('usage_tracking')
      .update({ invoice_count: (existing.invoice_count || 0) + 1, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('year_month', yearMonth);
  } else {
    await db
      .from('usage_tracking')
      .insert({ user_id: userId, year_month: yearMonth, invoice_count: 1 });
  }
}

// ============================================================
// BILLS
// ============================================================
app.get('/api/bills', requireAuth, async (req, res) => {
  const { data, error } = await getDb(req)
    .from('bills')
    .select('data, invoice_date')
    .eq('user_id', req.userId)
    .order('invoice_date', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(r => r.data));
});

app.post('/api/bills', requireAuth, checkInvoiceLimit, async (req, res) => {
  const bill = req.body;
  if (!bill || !bill.id) return res.status(400).json({ error: 'Bill must have an id' });

  const { error } = await getDb(req)
    .from('bills')
    .upsert({
      user_id: req.userId,
      bill_id: bill.id,
      data: bill,
      invoice_date: bill.invoiceDate || null,
      invoice_type: bill.invoiceType || 'tax-invoice',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,bill_id' });

  if (error) return res.status(500).json({ error: error.message });

  if (req.isNewBill) await incrementUsage(req.userId);

  res.json({ success: true });
});

app.delete('/api/bills/:id', requireAuth, async (req, res) => {
  const { error } = await getDb(req)
    .from('bills')
    .delete()
    .eq('user_id', req.userId)
    .eq('bill_id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ============================================================
// PROFILE (active business profile)
// ============================================================
const DEFAULT_PROFILE = {
  businessName: '', address: '', state: '', gstin: '', pan: '',
  email: '', phone: '', bankName: '', accountNumber: '', ifsc: '',
  logo: '', signature: '', upiId: '', googleClientId: '', googleDriveFolder: 'GST Billing Invoices',
};

app.get('/api/profile', requireAuth, async (req, res) => {
  const db = getDb(req);
  const { data } = await db
    .from('business_profiles')
    .select('*')
    .eq('user_id', req.userId)
    .eq('is_active', true)
    .maybeSingle();

  if (data) return res.json(mapProfileFromDb(data));

  const { data: first } = await db
    .from('business_profiles')
    .select('*')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  res.json(first ? mapProfileFromDb(first) : DEFAULT_PROFILE);
});

app.post('/api/profile', requireAuth, async (req, res) => {
  const db = getDb(req);
  await db
    .from('business_profiles')
    .update({ is_active: false })
    .eq('user_id', req.userId);

  const dbProfile = mapProfileToDb(req.body, req.userId, true);
  const { error } = await db
    .from('business_profiles')
    .upsert(dbProfile, { onConflict: 'id' });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ============================================================
// BUSINESS PROFILES (multi-business)
// ============================================================
app.get('/api/profiles', requireAuth, async (req, res) => {
  const { data, error } = await getDb(req)
    .from('business_profiles')
    .select('*')
    .eq('user_id', req.userId)
    .order('business_name', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(mapProfileFromDb));
});

app.post('/api/profiles', requireAuth, async (req, res) => {
  const dbProfile = mapProfileToDb(req.body, req.userId, false);
  const { data, error } = await getDb(req)
    .from('business_profiles')
    .upsert(dbProfile, { onConflict: 'id' })
    .select('id')
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, id: data?.id || dbProfile.id });
});

app.delete('/api/profiles/:id', requireAuth, async (req, res) => {
  const { error } = await getDb(req)
    .from('business_profiles')
    .delete()
    .eq('user_id', req.userId)
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

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

function mapProfileToDb(p, userId, isActive) {
  const { businessName, address, city, pin, state, country, gstin, pan, email,
    phone, bankName, accountNumber, ifsc, upiId, logo, signature,
    googleClientId, googleDriveFolder, id, ...extra } = p;
  return {
    ...(id ? { id } : {}),
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

// ============================================================
// CLIENTS
// ============================================================
app.get('/api/clients', requireAuth, async (req, res) => {
  const { data, error } = await getDb(req)
    .from('clients')
    .select('data')
    .eq('user_id', req.userId)
    .order('name', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(r => r.data));
});

app.post('/api/clients', requireAuth, async (req, res) => {
  const client = req.body;
  if (!client.id) client.id = 'cli_' + Date.now();

  const { error } = await getDb(req)
    .from('clients')
    .upsert({
      user_id: req.userId,
      client_id: client.id,
      data: client,
      name: client.name || '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,client_id' });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, id: client.id });
});

app.delete('/api/clients/:id', requireAuth, async (req, res) => {
  const { error } = await getDb(req)
    .from('clients')
    .delete()
    .eq('user_id', req.userId)
    .eq('client_id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ============================================================
// TERMS TEMPLATES
// ============================================================
const DEFAULT_TEMPLATE = {
  id: 'default',
  name: 'Standard Terms',
  content: '1. Payment is due within 15 days of invoice date unless otherwise agreed in writing.\n2. Interest @ 18% p.a. will be charged on overdue payments beyond the due date.\n3. The scope of work is limited to what is explicitly mentioned in the project proposal/agreement. Any additional requirements will be quoted and billed separately.\n4. All intellectual property and source code will be transferred to the client only upon receipt of full payment.\n5. We shall not be liable for any delays caused by incomplete or late submission of content, credentials, or approvals from the client\'s end.\n6. Any change requests after project approval may attract additional charges and revised timelines.\n7. This invoice is subject to the jurisdiction of courts at the service provider\'s registered location.\n8. E. & O.E.',
};

app.get('/api/templates', requireAuth, async (req, res) => {
  const db = getDb(req);
  const { data } = await db
    .from('terms_templates')
    .select('data')
    .eq('user_id', req.userId)
    .order('name', { ascending: true });

  let templates = (data || []).map(r => r.data);
  if (templates.length === 0) {
    await db.from('terms_templates').insert({
      user_id: req.userId,
      template_id: 'default',
      data: DEFAULT_TEMPLATE,
      name: 'Standard Terms',
    });
    templates = [DEFAULT_TEMPLATE];
  }
  res.json(templates);
});

app.post('/api/templates', requireAuth, async (req, res) => {
  const tpl = req.body;
  if (!tpl.id) tpl.id = 'tpl_' + Date.now();

  const { error } = await getDb(req)
    .from('terms_templates')
    .upsert({
      user_id: req.userId,
      template_id: tpl.id,
      data: tpl,
      name: tpl.name || '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,template_id' });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, id: tpl.id });
});

app.delete('/api/templates/:id', requireAuth, async (req, res) => {
  const { error } = await getDb(req)
    .from('terms_templates')
    .delete()
    .eq('user_id', req.userId)
    .eq('template_id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ============================================================
// PRODUCTS / INVENTORY
// ============================================================
app.get('/api/products', requireAuth, async (req, res) => {
  const { data, error } = await getDb(req)
    .from('products')
    .select('data')
    .eq('user_id', req.userId)
    .order('name', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(r => r.data));
});

app.post('/api/products', requireAuth, async (req, res) => {
  const product = req.body;
  if (!product.id) product.id = 'prod_' + Date.now();

  const { error } = await getDb(req)
    .from('products')
    .upsert({
      user_id: req.userId,
      product_id: product.id,
      data: product,
      name: product.name || '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,product_id' });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, id: product.id });
});

app.delete('/api/products/:id', requireAuth, async (req, res) => {
  const { error } = await getDb(req)
    .from('products')
    .delete()
    .eq('user_id', req.userId)
    .eq('product_id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ============================================================
// EXPENSES
// ============================================================
app.get('/api/expenses', requireAuth, async (req, res) => {
  const { data, error } = await getDb(req)
    .from('expenses')
    .select('data')
    .eq('user_id', req.userId)
    .order('expense_date', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(r => r.data));
});

app.post('/api/expenses', requireAuth, async (req, res) => {
  const expense = req.body;
  if (!expense.id) expense.id = 'exp_' + Date.now();

  const { error } = await getDb(req)
    .from('expenses')
    .upsert({
      user_id: req.userId,
      expense_id: expense.id,
      data: expense,
      expense_date: expense.date || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,expense_id' });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, id: expense.id });
});

app.delete('/api/expenses/:id', requireAuth, async (req, res) => {
  const { error } = await getDb(req)
    .from('expenses')
    .delete()
    .eq('user_id', req.userId)
    .eq('expense_id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ============================================================
// RECURRING INVOICES
// ============================================================
app.get('/api/recurring', requireAuth, async (req, res) => {
  const { data, error } = await getDb(req)
    .from('recurring_invoices')
    .select('data')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(r => r.data));
});

app.post('/api/recurring', requireAuth, async (req, res) => {
  const item = req.body;
  if (!item.id) item.id = 'rec_' + Date.now();

  const { error } = await getDb(req)
    .from('recurring_invoices')
    .upsert({
      user_id: req.userId,
      recurring_id: item.id,
      data: item,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,recurring_id' });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, id: item.id });
});

app.delete('/api/recurring/:id', requireAuth, async (req, res) => {
  const { error } = await getDb(req)
    .from('recurring_invoices')
    .delete()
    .eq('user_id', req.userId)
    .eq('recurring_id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ============================================================
// RECEIPTS / PAYMENT VOUCHERS
// ============================================================
app.get('/api/receipts', requireAuth, async (req, res) => {
  const { data, error } = await getDb(req)
    .from('receipts')
    .select('data')
    .eq('user_id', req.userId)
    .order('receipt_date', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(r => r.data));
});

app.post('/api/receipts', requireAuth, async (req, res) => {
  const receipt = req.body;
  if (!receipt.id) receipt.id = 'rcp_' + Date.now();

  const { error } = await getDb(req)
    .from('receipts')
    .upsert({
      user_id: req.userId,
      receipt_id: receipt.id,
      data: receipt,
      receipt_date: receipt.date || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,receipt_id' });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, id: receipt.id });
});

app.delete('/api/receipts/:id', requireAuth, async (req, res) => {
  const { error } = await getDb(req)
    .from('receipts')
    .delete()
    .eq('user_id', req.userId)
    .eq('receipt_id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ============================================================
// PURCHASES (Purchase Bills for ITC)
// ============================================================
app.get('/api/purchases', requireAuth, async (req, res) => {
  const { data, error } = await getDb(req)
    .from('purchases')
    .select('data')
    .eq('user_id', req.userId)
    .order('purchase_date', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(r => r.data));
});

app.post('/api/purchases', requireAuth, async (req, res) => {
  const purchase = req.body;
  if (!purchase.id) purchase.id = 'pur_' + Date.now();

  const { error } = await getDb(req)
    .from('purchases')
    .upsert({
      user_id: req.userId,
      purchase_id: purchase.id,
      data: purchase,
      purchase_date: purchase.date || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,purchase_id' });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, id: purchase.id });
});

app.delete('/api/purchases/:id', requireAuth, async (req, res) => {
  const { error } = await getDb(req)
    .from('purchases')
    .delete()
    .eq('user_id', req.userId)
    .eq('purchase_id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ============================================================
// META (counters, settings, preferences)
// ============================================================
app.get('/api/meta/:key', requireAuth, async (req, res) => {
  const { data } = await getDb(req)
    .from('meta_store')
    .select('meta_value')
    .eq('user_id', req.userId)
    .eq('meta_key', req.params.key)
    .maybeSingle();

  res.json({ value: data?.meta_value ?? null });
});

app.post('/api/meta/:key', requireAuth, async (req, res) => {
  const { error } = await getDb(req)
    .from('meta_store')
    .upsert({
      user_id: req.userId,
      meta_key: req.params.key,
      meta_value: req.body.value,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,meta_key' });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Atomic increment via Postgres function, fallback to manual read-increment-write
app.post('/api/meta/:key/increment', requireAuth, async (req, res) => {
  const db = getDb(req);
  const { data, error } = await db
    .rpc('increment_invoice_counter', { p_user_id: req.userId, p_key: req.params.key });

  if (error) {
    const { data: existing } = await db
      .from('meta_store')
      .select('meta_value')
      .eq('user_id', req.userId)
      .eq('meta_key', req.params.key)
      .maybeSingle();

    const next = ((existing?.meta_value) || 0) + 1;
    await db
      .from('meta_store')
      .upsert({
        user_id: req.userId,
        meta_key: req.params.key,
        meta_value: next,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,meta_key' });

    return res.json({ value: next });
  }

  res.json({ value: data });
});

// ============================================================
// EXPORT / IMPORT
// ============================================================
app.get('/api/export', requireAuth, async (req, res) => {
  const db = getDb(req);
  const uid = req.userId;

  const [bills, profileRow, clients, termsTemplates, products, expenses, recurring,
    receipts, profilesAll, purchases, metaRows] = await Promise.all([
    db.from('bills').select('data').eq('user_id', uid).then(r => (r.data || []).map(x => x.data)),
    db.from('business_profiles').select('*').eq('user_id', uid).eq('is_active', true).maybeSingle().then(r => r.data),
    db.from('clients').select('data').eq('user_id', uid).then(r => (r.data || []).map(x => x.data)),
    db.from('terms_templates').select('data').eq('user_id', uid).then(r => (r.data || []).map(x => x.data)),
    db.from('products').select('data').eq('user_id', uid).then(r => (r.data || []).map(x => x.data)),
    db.from('expenses').select('data').eq('user_id', uid).then(r => (r.data || []).map(x => x.data)),
    db.from('recurring_invoices').select('data').eq('user_id', uid).then(r => (r.data || []).map(x => x.data)),
    db.from('receipts').select('data').eq('user_id', uid).then(r => (r.data || []).map(x => x.data)),
    db.from('business_profiles').select('*').eq('user_id', uid).then(r => (r.data || []).map(mapProfileFromDb)),
    db.from('purchases').select('data').eq('user_id', uid).then(r => (r.data || []).map(x => x.data)),
    db.from('meta_store').select('meta_key,meta_value').eq('user_id', uid).then(r => Object.fromEntries((r.data || []).map(x => [x.meta_key, x.meta_value]))),
  ]);

  const profile = profileRow ? mapProfileFromDb(profileRow) : DEFAULT_PROFILE;
  res.json({ bills, profile, clients, termsTemplates, products, expenses, recurring, receipts, profiles: profilesAll, purchases, meta: metaRows, exportedAt: new Date().toISOString() });
});

app.post('/api/import', requireAuth, async (req, res) => {
  const data = req.body;
  const db = getDb(req);
  const uid = req.userId;
  let billCount = 0, clientCount = 0, templateCount = 0, productCount = 0;

  if (data.bills) for (const bill of data.bills) {
    if (bill.id) { await db.from('bills').upsert({ user_id: uid, bill_id: bill.id, data: bill, invoice_date: bill.invoiceDate || null, invoice_type: bill.invoiceType || 'tax-invoice' }, { onConflict: 'user_id,bill_id' }); billCount++; }
  }
  if (data.clients) for (const cli of data.clients) {
    if (cli.id) { await db.from('clients').upsert({ user_id: uid, client_id: cli.id, data: cli, name: cli.name || '' }, { onConflict: 'user_id,client_id' }); clientCount++; }
  }
  if (data.termsTemplates) for (const tpl of data.termsTemplates) {
    if (tpl.id) { await db.from('terms_templates').upsert({ user_id: uid, template_id: tpl.id, data: tpl, name: tpl.name || '' }, { onConflict: 'user_id,template_id' }); templateCount++; }
  }
  if (data.products) for (const prod of data.products) {
    if (prod.id) { await db.from('products').upsert({ user_id: uid, product_id: prod.id, data: prod, name: prod.name || '' }, { onConflict: 'user_id,product_id' }); productCount++; }
  }
  if (data.expenses) for (const exp of data.expenses) {
    if (exp.id) await db.from('expenses').upsert({ user_id: uid, expense_id: exp.id, data: exp, expense_date: exp.date || null }, { onConflict: 'user_id,expense_id' });
  }
  if (data.recurring) for (const rec of data.recurring) {
    if (rec.id) await db.from('recurring_invoices').upsert({ user_id: uid, recurring_id: rec.id, data: rec }, { onConflict: 'user_id,recurring_id' });
  }
  if (data.receipts) for (const rcp of data.receipts) {
    if (rcp.id) await db.from('receipts').upsert({ user_id: uid, receipt_id: rcp.id, data: rcp, receipt_date: rcp.date || null }, { onConflict: 'user_id,receipt_id' });
  }
  if (data.purchases) for (const pur of data.purchases) {
    if (pur.id) await db.from('purchases').upsert({ user_id: uid, purchase_id: pur.id, data: pur, purchase_date: pur.date || null }, { onConflict: 'user_id,purchase_id' });
  }
  if (data.profile) await db.from('business_profiles').upsert(mapProfileToDb(data.profile, uid, true), { onConflict: 'id' });
  if (data.meta) for (const [key, value] of Object.entries(data.meta)) {
    await db.from('meta_store').upsert({ user_id: uid, meta_key: key, meta_value: value }, { onConflict: 'user_id,meta_key' });
  }

  res.json({ billCount, clientCount, templateCount, productCount, hasProfile: !!data.profile });
});

// ============================================================
// USER ACCOUNT
// ============================================================
app.get('/api/account', requireAuth, async (req, res) => {
  const { data } = await getDb(req)
    .from('user_profiles')
    .select('*')
    .eq('id', req.userId)
    .maybeSingle();

  res.json(data || { id: req.userId, plan: 'free', display_name: '' });
});

app.patch('/api/account', requireAuth, async (req, res) => {
  const { displayName } = req.body;
  const updates = { updated_at: new Date().toISOString() };
  if (displayName !== undefined) updates.display_name = displayName;

  const { error } = await getDb(req)
    .from('user_profiles')
    .upsert({ id: req.userId, ...updates }, { onConflict: 'id' });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ============================================================
// USAGE / PLAN INFO
// ============================================================
app.get('/api/usage', requireAuth, async (req, res) => {
  const yearMonth = new Date().toISOString().slice(0, 7);
  const { data } = await getDb(req)
    .from('usage_tracking')
    .select('invoice_count')
    .eq('user_id', req.userId)
    .eq('year_month', yearMonth)
    .maybeSingle();

  res.json({
    plan: req.userPlan,
    invoicesThisMonth: data?.invoice_count || 0,
    limit: req.userPlan === 'pro' ? null : 10,
    yearMonth,
  });
});

// ============================================================
// GST CREDENTIALS (Pro only)
// ============================================================
app.get('/api/gst-credentials', requireAuth, async (req, res) => {
  if (req.userPlan !== 'pro') return res.status(403).json({ error: 'GST API credentials require Pro plan' });

  const { data } = await getDb(req)
    .from('gst_credentials')
    .select('gstin, username, app_key, notes, created_at, updated_at')
    .eq('user_id', req.userId)
    .maybeSingle();

  res.json(data || null);
});

app.post('/api/gst-credentials', requireAuth, async (req, res) => {
  if (req.userPlan !== 'pro') return res.status(403).json({ error: 'GST API credentials require Pro plan' });

  const { gstin, username, password, appKey, notes } = req.body;
  if (!gstin || !username) return res.status(400).json({ error: 'GSTIN and username are required' });

  const record = { user_id: req.userId, gstin, username, app_key: appKey || '', notes: notes || '', updated_at: new Date().toISOString() };
  if (password) record.password_encrypted = password;

  const { error } = await getDb(req)
    .from('gst_credentials')
    .upsert(record, { onConflict: 'user_id' });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.delete('/api/gst-credentials', requireAuth, async (req, res) => {
  const { error } = await getDb(req)
    .from('gst_credentials')
    .delete()
    .eq('user_id', req.userId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ============================================================
// Version check
// ============================================================
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));

app.get('/api/version', (req, res) => res.json({ current: pkg.version }));

function compareSemver(a, b) {
  const pa = String(a || '0').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b || '0').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

app.get('/api/check-update', async (req, res) => {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const [pkgRes, relRes] = await Promise.all([
      fetch('https://raw.githubusercontent.com/IamRamgarhia/Free-GST-Billing-Software/main/package.json', { signal: ctrl.signal }),
      fetch('https://api.github.com/repos/IamRamgarhia/Free-GST-Billing-Software/releases/latest', {
        signal: ctrl.signal,
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'GSTBillSaaS-update-check' },
      }).catch(() => null),
    ]);
    clearTimeout(t);
    if (!pkgRes.ok) throw new Error('GitHub fetch failed');
    const remote = await pkgRes.json();
    const updateAvailable = compareSemver(remote.version, pkg.version) > 0;
    let releaseNotes = null, releaseUrl = null, releasePublishedAt = null, releaseTag = null;
    if (relRes && relRes.ok) {
      const rel = await relRes.json();
      releaseNotes = rel.body || null;
      releaseUrl = rel.html_url || null;
      releasePublishedAt = rel.published_at || null;
      releaseTag = rel.tag_name || null;
    }
    res.json({ current: pkg.version, latest: remote.version, updateAvailable, releaseNotes, releaseUrl, releasePublishedAt, releaseTag });
  } catch {
    res.json({ current: pkg.version, latest: null, updateAvailable: false, error: 'Could not check for updates' });
  }
});

// ============================================================
// Health check
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({ ok: true, version: pkg.version, uptimeSec: Math.round(process.uptime()) });
});

// ============================================================
// Serve production build
// ============================================================
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('{*path}', (req, res) => {
    if (!req.path.startsWith('/api')) res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ============================================================
// Error logging + graceful shutdown
// ============================================================
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));

let activeServer = null;
function startServer(port) {
  const server = app.listen(port, () => {
    activeServer = server;
    console.log(`\n  GST Billing SaaS running at http://localhost:${port}`);
    console.log(`  Supabase: ${SUPABASE_URL}\n`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && port < DEFAULT_PORT + 10) startServer(port + 1);
    else { console.error(`Failed to start: ${err.message}`); process.exit(1); }
  });
}

function gracefulShutdown(signal) {
  if (!activeServer) { process.exit(0); return; }
  const force = setTimeout(() => process.exit(1), 3000);
  force.unref();
  activeServer.close(() => { clearTimeout(force); process.exit(0); });
}
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

startServer(parseInt(process.env.PORT || DEFAULT_PORT, 10));
