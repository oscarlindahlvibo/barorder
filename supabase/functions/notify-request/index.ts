import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RequestType =
  | 'restock'
  | 'crate_pickup'
  | 'waste_pickup'
  | 'security_call'
  | 'it_support'
  | 'serving_manager';

const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  restock: 'Påfyllning',
  crate_pickup: 'Tombackar',
  waste_pickup: 'Avfall',
  security_call: 'Ordningsvakt',
  it_support: 'IT-support',
  serving_manager: 'Serveringsansvarig',
};

const STAFF_CALL_TYPES = ['security_call', 'it_support', 'serving_manager'];

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return Response.json({ error: 'Missing push configuration' }, { status: 500, headers: corsHeaders });
  }

  const { requestId } = await req.json().catch(() => ({ requestId: null }));
  if (!requestId) {
    return Response.json({ error: 'Missing requestId' }, { status: 400, headers: corsHeaders });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: request, error } = await supabase
    .from('restock_requests')
    .select('*, users(id, name, role), locations(id, name), restock_request_items(*)')
    .eq('id', requestId)
    .maybeSingle();

  if (error || !request) {
    return Response.json({ error: error?.message ?? 'Request not found' }, { status: 404, headers: corsHeaders });
  }

  const requestType = (request.request_type ?? 'restock') as RequestType;
  const targetRoles = STAFF_CALL_TYPES.includes(requestType)
    ? ['personal', 'serveringsansvarig', 'admin']
    : ['lager', 'admin'];

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('role', targetRoles)
    .eq('active', true);

  const location = request.locations?.name ?? 'Okänd plats';
  const typeLabel = REQUEST_TYPE_LABELS[requestType] ?? 'Ärende';
  const items = request.restock_request_items
    ?.map((item: { quantity: number; product_name: string }) => `${item.quantity}× ${item.product_name}`)
    .join(', ') ?? '';

  const payload = JSON.stringify({
    title: request.priority === 'akut' ? `AKUT! ${typeLabel} - ${location}` : `${typeLabel} - ${location}`,
    body: items || 'Nytt ärende väntar.',
    tag: request.id,
    url: '/',
    requireInteraction: request.priority === 'akut',
  });

  const results = await Promise.allSettled((subscriptions ?? []).map(async subscription => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      }, payload);
      return true;
    } catch (sendError) {
      const statusCode = (sendError as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase
          .from('push_subscriptions')
          .update({ active: false })
          .eq('endpoint', subscription.endpoint);
      }
      return false;
    }
  }));

  return Response.json({
    sent: results.filter(result => result.status === 'fulfilled' && result.value).length,
    attempted: subscriptions?.length ?? 0,
  }, { headers: corsHeaders });
});
