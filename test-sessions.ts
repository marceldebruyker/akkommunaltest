import 'dotenv/config';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
async function run() {
  const session1 = await stripe.checkout.sessions.retrieve('cs_test_a12GqjmLkxV4XTvb07CS6RtY8oSadK5A9H17gQ4JUwLnRDHqjFDLAHSQZB');
  const session2 = await stripe.checkout.sessions.retrieve('cs_test_a1VydAykYGebl5MGrSWeRHnbNC9PVKQbLKK16Ti5xPE6zqn0IFcJUrepbd');
  console.log('Session 1 Invoice:', session1.invoice);
  console.log('Session 2 Invoice:', session2.invoice);
}
run().catch(console.error);
