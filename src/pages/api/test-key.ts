export const GET = async () => {
  const key = import.meta.env.STRIPE_SECRET_KEY;
  return new Response(`[${key}] length: ${key.length}`);
};
