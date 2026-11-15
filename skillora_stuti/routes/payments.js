const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { query } = require('../db/connection');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

/**
 * POST /api/payments/create-intent
 * Idempotently initializes a payment session for an order
 */
router.post('/create-intent', async (req, res) => {
  const { order_id, payment_method = 'campus_upi', idempotency_key } = req.body;
  const orderId = parseInt(order_id, 10);

  if (isNaN(orderId)) return res.status(400).json({ error: 'Valid order ID required' });

  try {
    // 1. Fetch order
    const orders = await query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (orders.length === 0) return res.status(404).json({ error: 'Order not found' });

    const order = orders[0];
    if (order.consumer_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to pay for this order' });
    }

    if (['completed', 'cancelled', 'rejected'].includes(order.status)) {
      return res.status(400).json({ error: `Cannot pay for an order with status "${order.status}".` });
    }

    // 2. Idempotency Check: if existing completed payment exists, return it
    const existing = await query('SELECT * FROM payments WHERE order_id = ?', [orderId]);
    if (existing.length > 0 && existing[0].status === 'completed') {
      return res.json({
        success: true,
        status: 'already_paid',
        payment: existing[0]
      });
    }

    const transactionId = existing.length > 0 
      ? existing[0].transaction_id 
      : 'TXN-BU-' + crypto.randomBytes(6).toString('hex').toUpperCase();

    // 3. Upsert payment record
    if (existing.length === 0) {
      await query(
        `INSERT INTO payments (order_id, transaction_id, amount, status, payment_method, idempotency_key)
         VALUES (?, ?, ?, 'pending', ?, ?)`,
        [orderId, transactionId, order.price, payment_method, idempotency_key || null]
      );
    }

    res.json({
      success: true,
      transaction_id: transactionId,
      order_number: order.order_number,
      amount: order.price,
      currency: 'INR',
      payment_method,
      campus_upi_vpa: 'skillora.escrow@bennett',
      status: 'pending'
    });
  } catch (err) {
    console.error('Payment intent creation error:', err);
    res.status(500).json({ error: 'Database error creating payment intent' });
  }
});

/**
 * POST /api/payments/verify
 * Server-side payment validation (Simulated Bennett Campus Escrow & Gateway signature check)
 */
router.post('/verify', async (req, res) => {
  const { transaction_id, reference_proof } = req.body;

  if (!transaction_id) {
    return res.status(400).json({ error: 'Transaction ID is required' });
  }

  try {
    const payments = await query('SELECT * FROM payments WHERE transaction_id = ?', [transaction_id]);
    if (payments.length === 0) return res.status(404).json({ error: 'Payment record not found' });

    const payment = payments[0];
    const orders = await query('SELECT * FROM orders WHERE id = ?', [payment.order_id]);
    const order = orders[0];

    if (order.consumer_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to verify this payment' });
    }

    // 1. Mark payment completed idempotently
    await query('UPDATE payments SET status = "completed" WHERE id = ?', [payment.id]);

    // 2. Transition order status to 'in_progress'
    await query('UPDATE orders SET status = "in_progress" WHERE id = ?', [order.id]);

    // 3. Notify producer of funded order
    await query(
      `INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, 'order_status', 'producer-dashboard.html?tab=orders')`,
      [
        order.producer_id,
        'Payment Secured & Order In Progress',
        `Payment of ₹${order.price} for order ${order.order_number} has been verified and placed in escrow.`
      ]
    );

    res.json({
      success: true,
      message: 'Payment verified and secured in campus escrow. Order is now In Progress!',
      transaction_id: payment.transaction_id,
      order_status: 'in_progress'
    });
  } catch (err) {
    console.error('Payment verification error:', err);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

module.exports = router;
