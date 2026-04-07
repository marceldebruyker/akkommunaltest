import 'dotenv/config';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
async function run() {
  const email = 'marcel.murschel@googlemail.com';
  console.log('Searching for customers with email:', email);
  const customers = await stripe.customers.list({ email: email });
  console.log('Found', customers.data.length, 'customers.');
  for (const c of customers.data) {
    const invoices = await stripe.invoices.list({ customer: c.id });
    console.log(`Customer ${c.id} has ${invoices.data.length} invoices.`);
    for (const inv of invoices.data) {
      console.log(`- Invoice ${inv.id} (${inv.number}): Status ${inv.status}, PDF: ${!!inv.invoice_pdf}`);
    }
  }
}
run().catch(console.error);
