import 'dotenv/config';
import Stripe from 'stripe';

const rawStripeKey = process.env.STRIPE_SECRET_KEY!;
const email = 'marcel.murschel@googlemail.com';

async function test() {
  let userInvoices: Stripe.Invoice[] = [];
  const stripe = new Stripe(rawStripeKey.trim());
  const customers = await stripe.customers.list({ email: email, limit: 3 });
  console.log('Customers found via same logic:', customers.data.length);
  for (const customer of customers.data) {
    const invoices = await stripe.invoices.list({ customer: customer.id, limit: 10, status: 'paid' });
    const openInvoices = await stripe.invoices.list({ customer: customer.id, limit: 10, status: 'open' });
    userInvoices = [...userInvoices, ...invoices.data, ...openInvoices.data];
  }
  userInvoices.sort((a, b) => b.created - a.created);
  console.log('Invoices found:', userInvoices.length);
  userInvoices.forEach(inv => console.log('ID:', inv.id, 'PDF:', !!inv.invoice_pdf));
}
test().catch(console.error);
