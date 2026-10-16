const crypto = require('crypto');
const { parseBody } = require('../../http/parse-body');
const { sendJson, sendError } = require('../../http/send');
const db = require('../../db/database');

function registerPaymentRoutes(router, { guard, orders }) {
  db.exec(`CREATE TABLE IF NOT EXISTS payment_intents (
    id TEXT PRIMARY KEY, provider_id TEXT UNIQUE, customer_id TEXT NOT NULL,
    payload_json TEXT NOT NULL, amount_paise INTEGER NOT NULL, status TEXT NOT NULL,
    order_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`);
  // Columns added after the first version: the provider's payment id and the refund state.
  const have = new Set(db.prepare('PRAGMA table_info(payment_intents)').all().map(c => c.name));
  for (const [name, type] of [['payment_id', 'TEXT'], ['refund_status', 'TEXT'], ['refund_id', 'TEXT'], ['refund_error', 'TEXT'], ['refund_amount_paise', 'INTEGER']]) {
    if (!have.has(name)) db.exec(`ALTER TABLE payment_intents ADD COLUMN ${name} ${type}`);
  }
  const now = () => new Date().toISOString();
  const setOrderPayment = (orderId, status) => {
    if (!orderId) return;
    db.prepare('UPDATE orders SET payment_status = ? WHERE id = ?').run(status, orderId);
    const live = orders.getById(orderId);
    if (live) live.paymentStatus = status;
  };

  /*
   * Refunds. An online payment is refunded in full when its order is cancelled or could not be
   * fulfilled, and when a paid order cannot be created at all (e.g. the cans sold out while the
   * customer was paying). refund_status: requested -> pending (accepted by Razorpay) -> processed,
   * or failed (a supplier can retry). A refund is requested once per payment.
   */
  async function startRefund(intentId, reason) {
    const intent = db.prepare('SELECT * FROM payment_intents WHERE id = ?').get(intentId);
    if (!intent || intent.status !== 'paid' || intent.refund_status) return;
    db.prepare('UPDATE payment_intents SET refund_status = ?, refund_amount_paise = ?, refund_error = NULL, updated_at = ? WHERE id = ?').run('requested', intent.amount_paise, now(), intent.id);
    setOrderPayment(intent.order_id, 'REFUND_PENDING');
    const fail = (message) => {
      db.prepare('UPDATE payment_intents SET refund_status = ?, refund_error = ?, updated_at = ? WHERE id = ?').run('failed', String(message).slice(0, 200), now(), intent.id);
    };
    try {
      if (!intent.payment_id) return fail('The payment id was not recorded; refund this payment from the Razorpay dashboard.');
      const { keyId, keySecret } = credentials();
      const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(intent.payment_id)}/refund`, {
        method: 'POST',
        headers: { Authorization: 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: intent.amount_paise, speed: 'normal', notes: { reason: String(reason || 'order cancelled').slice(0, 100), order_id: intent.order_id || '' } }),
      });
      const data = await response.json();
      if (!response.ok) return fail(data.error?.description || 'Razorpay could not start the refund.');
      const processed = data.status === 'processed';
      db.prepare('UPDATE payment_intents SET refund_status = ?, refund_id = ?, updated_at = ? WHERE id = ?').run(processed ? 'processed' : 'pending', data.id || null, now(), intent.id);
      setOrderPayment(intent.order_id, processed ? 'REFUNDED' : 'REFUND_PENDING');
    } catch (err) {
      fail(err.message || 'Could not reach Razorpay.');
    }
  }

  // Cancelled or unfulfilled orders that were paid online get their money back.
  orders.on((kind, order) => {
    if (kind !== 'transition' || (order.status !== 'cancelled' && order.status !== 'failed')) return;
    const intent = db.prepare("SELECT id FROM payment_intents WHERE order_id = ? AND status = 'paid' AND refund_status IS NULL").get(order.id);
    if (intent) startRefund(intent.id, 'order ' + order.status);
  });

  const credentials = () => {
    const keyId = process.env.RAZORPAY_KEY_ID, keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) { const e = new Error('Online payments are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the API server.'); e.status = 503; e.code = 'PAYMENT_PROVIDER_NOT_CONFIGURED'; throw e; }
    return { keyId, keySecret };
  };
  router.add('POST', '/v1/payments/razorpay/link', guard(['CUSTOMER'], async (req, res) => {
    const body = await parseBody(req), supplierId = String(body.supplierId || '').trim(), items = Array.isArray(body.items) ? body.items : [];
    if (!supplierId || !items.length) { const e = new Error('Choose a supplier and at least one item.'); e.status = 400; e.code = 'INVALID_ORDER'; throw e; }
    let amountPaise = 0; const normalizedItems = [];
    for (const item of items) {
      const qty = Number(item.qty);
      if (!Number.isInteger(qty) || qty < 1 || qty > 100) { const e = new Error('Item quantity must be between 1 and 100.'); e.status = 400; e.code = 'INVALID_QUANTITY'; throw e; }
      const product = db.prepare('SELECT id, supplier_id AS supplierId, unit_price_paise AS price FROM products WHERE id = ?').get(String(item.productId || ''));
      if (!product || product.supplierId !== supplierId) { const e = new Error('A selected product does not belong to this supplier.'); e.status = 400; e.code = 'INVALID_PRODUCT'; throw e; }
      amountPaise += Number(product.price) * qty; normalizedItems.push({ productId: product.id, qty });
    }
    if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) { const e = new Error('Payment amount is invalid or below ₹1.'); e.status = 400; e.code = 'INVALID_AMOUNT'; throw e; }
    const { keyId, keySecret } = credentials(), intentId = crypto.randomUUID();
    const customer = db.prepare('SELECT name, phone, email FROM users WHERE id = ?').get(req.user.id) || {};
    const callbackUrl = process.env.RAZORPAY_CALLBACK_URL;
    const linkBody = { amount: amountPaise, currency: 'INR', accept_partial: false, description: 'Water-O-Water delivery order', reference_id: intentId,
      customer: { name: customer.name || 'Water-O-Water customer', ...(customer.phone ? { contact: customer.phone } : {}), ...(customer.email ? { email: customer.email } : {}) },
      notify: { sms: Boolean(customer.phone), email: Boolean(customer.email) }, reminder_enable: false,
      ...(callbackUrl ? { callback_url: callbackUrl, callback_method: 'get' } : {}), notes: { wow_intent_id: intentId, customer_id: req.user.customerId } };
    const response = await fetch('https://api.razorpay.com/v1/payment_links', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64'), 'Content-Type': 'application/json' }, body: JSON.stringify(linkBody) });
    const data = await response.json();
    if (!response.ok) { const e = new Error(data.error?.description || 'Could not create payment link.'); e.status = response.status === 429 ? 429 : 502; e.code = 'PAYMENT_PROVIDER_ERROR'; throw e; }
    const now = new Date().toISOString();
    db.prepare('INSERT INTO payment_intents (id, provider_id, customer_id, payload_json, amount_paise, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(intentId, data.id, req.user.customerId, JSON.stringify({ ...body, items: normalizedItems, supplierId }), amountPaise, 'created', now, now);
    sendJson(res, 201, { data: { intentId, paymentLinkId: data.id, shortUrl: data.short_url, amountPaise, currency: 'INR', status: data.status } });
  }));
  router.add('GET', '/v1/payments', guard(['CUSTOMER'], (req, res) => {
    const rows = db.prepare(`SELECT id, provider_id AS paymentLinkId, amount_paise AS amountPaise,
      status, order_id AS orderId, created_at AS createdAt, updated_at AS updatedAt,
      refund_status AS refundStatus, refund_amount_paise AS refundAmountPaise
      FROM payment_intents WHERE customer_id = ? ORDER BY created_at DESC LIMIT 100`).all(req.user.customerId);
    sendJson(res, 200, { data: rows });
  }));
  router.add('GET', '/v1/payments/:id', guard(['CUSTOMER'], (req, res) => {
    const row = db.prepare('SELECT id, amount_paise AS amountPaise, status, order_id AS orderId, created_at AS createdAt, refund_status AS refundStatus, refund_amount_paise AS refundAmountPaise, refund_error AS refundError FROM payment_intents WHERE id = ? AND customer_id = ?').get(req.params.id, req.user.customerId);
    if (!row) return sendError(res, 404, 'NOT_FOUND', 'Payment not found');
    sendJson(res, 200, { data: row });
  }));
  /*
   * The customer's payment history, newest first: one row per order (cash or online) plus online
   * payments that never became an order (cancelled/expired links, refunded sold-out orders).
   *   GET /v1/history/payments?limit=20&before=<cursor>
   * status: pay_on_delivery | paid_cash | paid | refund_pending | refunded | cancelled | pending | expired | failed
   */
  router.add('GET', '/v1/history/payments', guard(['CUSTOMER'], (req, res) => {
    const rows = [];
    for (const o of orders.listFor(req.user)) {
      const online = o.paymentMethod === 'UPI';
      const gone = o.status === 'cancelled' || o.status === 'failed';
      const done = o.status === 'delivered' || o.status === 'settled';
      let status;
      if (online) status = o.paymentStatus === 'REFUNDED' ? 'refunded' : o.paymentStatus === 'REFUND_PENDING' ? 'refund_pending' : o.paymentStatus === 'PAID' ? 'paid' : gone ? 'cancelled' : 'pending';
      else status = gone ? 'cancelled' : done ? 'paid_cash' : 'pay_on_delivery';
      rows.push({ id: 'order-' + o.id, orderId: o.id, code: o.code, method: online ? 'UPI' : 'COD', amountPaise: o.totalPaise, status, orderStatus: o.status, at: o.createdAt });
    }
    const intents = db.prepare("SELECT id, status, amount_paise AS amountPaise, refund_status AS refundStatus, created_at AS at FROM payment_intents WHERE customer_id = ? AND order_id IS NULL").all(req.user.customerId);
    for (const i of intents) {
      const status = i.status === 'paid' ? (i.refundStatus === 'processed' ? 'refunded' : 'refund_pending') : i.status === 'created' ? 'pending' : i.status;
      rows.push({ id: 'pay-' + i.id, orderId: null, code: null, method: 'UPI', amountPaise: i.amountPaise, status, orderStatus: null, at: i.at });
    }
    rows.sort((a, b) => (a.at === b.at ? (a.id < b.id ? 1 : -1) : a.at < b.at ? 1 : -1));
    const limit = Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1) return sendJson(res, 200, { data: rows });
    let start = 0;
    if (req.query.before) {
      const [at, id] = String(req.query.before).split('|');
      start = rows.findIndex((r) => r.at < at || (r.at === at && r.id < id));
      if (start < 0) start = rows.length;
    }
    const page = rows.slice(start, start + Math.min(limit, 100));
    const last = page[page.length - 1];
    const hasMore = start + page.length < rows.length;
    sendJson(res, 200, { data: page, meta: { total: rows.length, hasMore, nextCursor: hasMore && last ? last.at + '|' + last.id : null } });
  }));

  // Refund state for an order, for the customer who paid and the supplier who fulfils it.
  router.add('GET', '/v1/orders/:id/refund', guard(['CUSTOMER', 'SUPPLIER'], (req, res) => {
    const order = orders.getForUser(req.params.id, req.user);
    if (!order) return sendError(res, 404, 'NOT_FOUND', 'Order not found');
    const row = db.prepare('SELECT status, refund_status AS refundStatus, refund_amount_paise AS amountPaise, refund_error AS error FROM payment_intents WHERE order_id = ?').get(order.id);
    sendJson(res, 200, { data: row && row.refundStatus ? { status: row.refundStatus, amountPaise: row.amountPaise, error: req.user.role === 'SUPPLIER' ? row.error : null } : null });
  }));
  // A supplier can retry a refund that failed (e.g. Razorpay was unreachable).
  router.add('POST', '/v1/orders/:id/refund/retry', guard(['SUPPLIER'], async (req, res) => {
    const order = orders.getForUser(req.params.id, req.user);
    if (!order) return sendError(res, 404, 'NOT_FOUND', 'Order not found');
    const row = db.prepare("SELECT id, refund_status AS refundStatus FROM payment_intents WHERE order_id = ? AND status = 'paid'").get(order.id);
    if (!row || row.refundStatus !== 'failed') return sendError(res, 409, 'NOTHING_TO_RETRY', 'There is no failed refund for this order');
    db.prepare('UPDATE payment_intents SET refund_status = NULL WHERE id = ?').run(row.id);
    await startRefund(row.id, 'retry');
    const after = db.prepare('SELECT refund_status AS status, refund_error AS error FROM payment_intents WHERE id = ?').get(row.id);
    sendJson(res, 200, { data: after });
  }));
  router.add('POST', '/v1/payments/razorpay/webhook', async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return sendError(res, 503, 'PAYMENT_WEBHOOK_NOT_CONFIGURED', 'Set RAZORPAY_WEBHOOK_SECRET on the API server.');
    const chunks = []; let size = 0;
    await new Promise((resolve, reject) => { req.on('data', c => { size += c.length; if (size > 1024 * 1024) { reject(new Error('Webhook payload too large')); req.destroy(); return; } chunks.push(c); }); req.on('end', resolve); req.on('error', reject); });
    const raw = Buffer.concat(chunks), signature = String(req.headers['x-razorpay-signature'] || ''), expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    if (!signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return sendError(res, 401, 'INVALID_WEBHOOK_SIGNATURE', 'Webhook signature is invalid');
    const event = JSON.parse(raw.toString('utf8'));
    const ack = () => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"received":true}'); };
    // Unsuccessful ends of a payment link: record them so the customer sees the real status.
    if (event.event === 'refund.processed' || event.event === 'refund.failed') {
      const refund = event.payload?.refund?.entity || {};
      const row = db.prepare('SELECT * FROM payment_intents WHERE refund_id = ? OR (payment_id = ? AND payment_id IS NOT NULL)').get(refund.id || '', refund.payment_id || '');
      if (row) {
        const ok = event.event === 'refund.processed';
        db.prepare('UPDATE payment_intents SET refund_status = ?, refund_id = COALESCE(refund_id, ?), refund_error = ?, updated_at = ? WHERE id = ?').run(ok ? 'processed' : 'failed', refund.id || null, ok ? null : 'Razorpay could not complete the refund.', now(), row.id);
        setOrderPayment(row.order_id, ok ? 'REFUNDED' : 'REFUND_PENDING');
      }
      return ack();
    }
    const ended = { 'payment_link.cancelled': 'cancelled', 'payment_link.expired': 'expired' }[event.event];
    if (ended) {
      const id = event.payload?.payment_link?.entity?.id;
      if (id) db.prepare("UPDATE payment_intents SET status = ?, updated_at = ? WHERE provider_id = ? AND status = 'created'").run(ended, new Date().toISOString(), id);
      return ack();
    }
    if (event.event !== 'payment_link.paid') return ack();
    const paymentLinkId = event.payload?.payment_link?.entity?.id;
    if (!paymentLinkId) return sendError(res, 400, 'INVALID_WEBHOOK', 'Payment link ID is missing');
    const intent = db.prepare('SELECT * FROM payment_intents WHERE provider_id = ?').get(paymentLinkId);
    if (intent && intent.status !== 'paid') {
      const payload = JSON.parse(intent.payload_json);
      const paymentId = event.payload?.payment?.entity?.id || null;
      let order = null, reason = '';
      try {
        order = orders.place({ ...payload, customerId: intent.customer_id, paymentMethod: 'UPI', paymentStatus: 'PAID', source: 'mobile', actorType: 'customer' });
      } catch (err) { reason = err.message || 'order could not be created'; }
      // The money was taken either way: record it, and refund it if no order could be made.
      db.prepare('UPDATE payment_intents SET status = ?, order_id = ?, payment_id = ?, updated_at = ? WHERE id = ?').run('paid', order ? order.id : null, paymentId, now(), intent.id);
      if (!order) startRefund(intent.id, reason);
    }
    ack();
  });
}
module.exports = { registerPaymentRoutes };
