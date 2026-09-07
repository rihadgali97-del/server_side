const Order  = require('../models/Order');
const User   = require('../models/User');
const Vendor = require('../models/Vendor');

// ─── Shared: build date filter from query params ──────────────────────────────
const dateFilter = ({ from, to, period }) => {
  const now = new Date();
  if (from || to) {
    const f = {};
    if (from) f.$gte = new Date(from);
    if (to)   f.$lte = new Date(new Date(to).setHours(23,59,59,999));
    return f;
  }
  switch (period) {
    case 'today':   return { $gte: new Date(now.setHours(0,0,0,0)) };
    case 'week':    return { $gte: new Date(Date.now() - 7*864e5) };
    case 'month':   return { $gte: new Date(Date.now() - 30*864e5) };
    case 'quarter': return { $gte: new Date(Date.now() - 90*864e5) };
    case 'year':    return { $gte: new Date(Date.now() - 365*864e5) };
    default:        return undefined;
  }
};

// ─── Shared: build order query ─────────────────────────────────────────────────
const buildQuery = (params, vendorId = null) => {
  const query = {};
  const df = dateFilter(params);
  if (df) query.createdAt = df;
  if (params.status) query.status = params.status;
  if (params.paymentMethod) query.paymentMethod = params.paymentMethod;
  if (vendorId) query['orderItems.vendor'] = vendorId;
  return query;
};

// ─── CSV builder ──────────────────────────────────────────────────────────────
const toCSV = (rows, headers) => {
  const escape = (v) => {
    const s = String(v ?? '').replace(/"/g, '""');
    return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s}"` : s;
  };
  const head = headers.map(h => escape(h.label)).join(',');
  const body = rows.map(row =>
    headers.map(h => escape(typeof h.fn === 'function' ? h.fn(row) : row[h.key])).join(',')
  );
  return [head, ...body].join('\r\n');
};

// ─── Shared: fetch orders with user populated ─────────────────────────────────
const fetchOrders = async (query) =>
  Order.find(query)
    .populate('user', 'name email phone')
    .populate('orderItems.vendor', 'businessName')
    .sort({ createdAt: -1 })
    .lean();

// ─── ORDER HEADERS ────────────────────────────────────────────────────────────
const ORDER_HEADERS = [
  { label: 'Order ID',       fn: r => r._id.toString().slice(-8).toUpperCase() },
  { label: 'Date',           fn: r => new Date(r.createdAt).toLocaleDateString('en-US') },
  { label: 'Customer',       fn: r => r.user?.name || 'Guest' },
  { label: 'Customer Email', fn: r => r.user?.email || '' },
  { label: 'Items',          fn: r => (r.orderItems||[]).length },
  { label: 'Total (ETB)',    fn: r => r.totalPrice?.toFixed(2) },
  { label: 'Status',         fn: r => r.status },
  { label: 'Payment',        fn: r => r.paymentMethod },
  { label: 'Paid',           fn: r => r.isPaid ? 'Yes' : 'No' },
  { label: 'City',           fn: r => r.shippingAddress?.city || '' },
  { label: 'Country',        fn: r => r.shippingAddress?.country || '' },
];

// ─── SUMMARY STATS ────────────────────────────────────────────────────────────
const calcSummary = (orders) => ({
  total:        orders.length,
  revenue:      orders.reduce((a,o) => a + (o.totalPrice||0), 0),
  paid:         orders.filter(o => o.isPaid).length,
  paidRevenue:  orders.filter(o => o.isPaid).reduce((a,o) => a + (o.totalPrice||0), 0),
  delivered:    orders.filter(o => o.status === 'delivered').length,
  pending:      orders.filter(o => ['pending','processing'].includes(o.status)).length,
  cancelled:    orders.filter(o => o.status === 'cancelled').length,
  avgOrderValue:orders.length
    ? (orders.reduce((a,o) => a + (o.totalPrice||0), 0) / orders.length)
    : 0,
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/export/orders/csv
exports.adminExportOrdersCSV = async (req, res) => {
  try {
    const orders = await fetchOrders(buildQuery(req.query));
    const csv    = toCSV(orders, ORDER_HEADERS);
    const fname  = `nextcart-orders-${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
};

// GET /api/admin/export/orders/json  (used by frontend PDF generator)
exports.adminExportOrdersJSON = async (req, res) => {
  try {
    const orders  = await fetchOrders(buildQuery(req.query));
    const summary = calcSummary(orders);
    res.json({ success:true, summary, data: orders });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
};

// GET /api/admin/export/revenue/csv  (monthly revenue breakdown)
exports.adminExportRevenueCSV = async (req, res) => {
  try {
    const query  = buildQuery(req.query);
    const orders = await fetchOrders({ ...query, isPaid: true });

    // Group by month
    const monthMap = {};
    orders.forEach(o => {
      const key = new Date(o.createdAt).toLocaleDateString('en-US',
        { year:'numeric', month:'short' });
      if (!monthMap[key]) monthMap[key] = { month:key, orders:0, revenue:0, delivered:0 };
      monthMap[key].orders++;
      monthMap[key].revenue   += o.totalPrice || 0;
      monthMap[key].delivered += o.status === 'delivered' ? 1 : 0;
    });

    const rows    = Object.values(monthMap);
    const headers = [
      { label:'Month',             key:'month' },
      { label:'Orders',            key:'orders' },
      { label:'Revenue (ETB)',     fn: r => r.revenue.toFixed(2) },
      { label:'Delivered',         key:'delivered' },
      { label:'Delivery Rate (%)', fn: r => ((r.delivered/r.orders)*100).toFixed(1) },
    ];
    const csv   = toCSV(rows, headers);
    const fname = `nextcart-revenue-${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
};

// GET /api/admin/export/vendors/csv  (per-vendor revenue)
exports.adminExportVendorRevenueCSV = async (req, res) => {
  try {
    const orders  = await fetchOrders(buildQuery(req.query));
    const vendors = await Vendor.find().populate('user','name email').lean();

    const vendorMap = {};
    vendors.forEach(v => {
      vendorMap[v._id.toString()] = {
        name:    v.businessName,
        email:   v.user?.email || '',
        orders:  0,
        revenue: 0,
        rank:    v.reputation?.rank || 'New',
        score:   v.reputation?.score || 0,
      };
    });

    orders.forEach(o => {
      (o.orderItems||[]).forEach(item => {
        const vid = item.vendor?._id?.toString() || item.vendor?.toString();
        if (vid && vendorMap[vid]) {
          vendorMap[vid].orders++;
          vendorMap[vid].revenue += item.price * item.quantity;
        }
      });
    });

    const rows    = Object.values(vendorMap).sort((a,b) => b.revenue - a.revenue);
    const headers = [
      { label:'Vendor',          key:'name' },
      { label:'Email',           key:'email' },
      { label:'Orders',          key:'orders' },
      { label:'Revenue (ETB)',   fn: r => r.revenue.toFixed(2) },
      { label:'Trust Rank',      key:'rank' },
      { label:'Trust Score',     key:'score' },
    ];
    const csv   = toCSV(rows, headers);
    const fname = `nextcart-vendor-revenue-${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// VENDOR EXPORTS  (scoped to their own orders only)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/vendors/export/orders/csv
exports.vendorExportOrdersCSV = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    if (!vendor) return res.status(404).json({ success:false, message:'Vendor not found' });

    const orders = await fetchOrders(buildQuery(req.query, vendor._id));
    const csv    = toCSV(orders, ORDER_HEADERS);
    const fname  = `my-orders-${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
};

// GET /api/vendors/export/revenue/json  (vendor dashboard PDF)
exports.vendorExportRevenueJSON = async (req, res) => {
  try {
    const vendor  = await Vendor.findOne({ user: req.user._id });
    if (!vendor) return res.status(404).json({ success:false, message:'Vendor not found' });

    const orders  = await fetchOrders(buildQuery(req.query, vendor._id));
    const summary = calcSummary(orders);
    res.json({ success:true, summary, data: orders });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
};