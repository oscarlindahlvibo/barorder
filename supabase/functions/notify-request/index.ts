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

interface NativePushToken {
  id: string;
  platform: 'ios' | 'android';
  token: string;
}

function base64UrlEncode(input: string | ArrayBuffer) {
  const bytes = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToArrayBuffer(pem: string) {
  const base64 = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function createJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  privateKeyPem: string,
  algorithm: RsaHashedImportParams | EcKeyImportParams,
) {
  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    algorithm,
    false,
    ['sign'],
  );
  const signatureAlgorithm = algorithm.name === 'ECDSA'
    ? { name: 'ECDSA', hash: 'SHA-256' }
    : { name: 'RSASSA-PKCS1-v1_5' };
  const signature = await crypto.subtle.sign(signatureAlgorithm, key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

async function getFcmAccessToken(serviceAccountJson: string) {
  const serviceAccount = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const assertion = await createJwt(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
    String(serviceAccount.private_key).replace(/\\n/g, '\n'),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
  );

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`FCM auth failed: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token as string;
}

async function sendFcmNotification(token: string, payload: {
  title: string;
  body: string;
  tag: string;
  urgent: boolean;
}) {
  const projectId = Deno.env.get('FCM_PROJECT_ID');
  const serviceAccountJson = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
  if (!projectId || !serviceAccountJson) return 'skipped';

  const accessToken = await getFcmAccessToken(serviceAccountJson);
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          tag: payload.tag,
          url: '/',
        },
        android: {
          priority: payload.urgent ? 'HIGH' : 'NORMAL',
          notification: {
            channel_id: 'urgent',
            sound: 'default',
            notification_priority: payload.urgent ? 'PRIORITY_MAX' : 'PRIORITY_DEFAULT',
          },
        },
      },
    }),
  });

  if (!response.ok) {
    if (response.status === 404 || response.status === 410) return 'inactive';
    throw new Error(`FCM send failed: ${response.status}`);
  }
  return 'sent';
}

async function sendApnsNotification(token: string, payload: {
  title: string;
  body: string;
  tag: string;
  urgent: boolean;
}) {
  const keyId = Deno.env.get('APNS_KEY_ID');
  const teamId = Deno.env.get('APNS_TEAM_ID');
  const bundleId = Deno.env.get('APNS_BUNDLE_ID');
  const privateKey = Deno.env.get('APNS_PRIVATE_KEY');
  const apnsEnv = Deno.env.get('APNS_ENV') ?? 'sandbox';
  if (!keyId || !teamId || !bundleId || !privateKey) return 'skipped';

  const now = Math.floor(Date.now() / 1000);
  const jwt = await createJwt(
    { alg: 'ES256', kid: keyId },
    { iss: teamId, iat: now },
    privateKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
  );
  const host = apnsEnv === 'production' ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com';
  const response = await fetch(`${host}/3/device/${token}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'apns-priority': payload.urgent ? '10' : '5',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      aps: {
        alert: {
          title: payload.title,
          body: payload.body,
        },
        sound: 'default',
        badge: 1,
      },
      tag: payload.tag,
      url: '/',
    }),
  });

  if (!response.ok) {
    if (response.status === 400 || response.status === 410) return 'inactive';
    throw new Error(`APNs send failed: ${response.status}`);
  }
  return 'sent';
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: 'Missing push configuration' }, { status: 500, headers: corsHeaders });
  }

  const { requestId } = await req.json().catch(() => ({ requestId: null }));
  if (!requestId) {
    return Response.json({ error: 'Missing requestId' }, { status: 400, headers: corsHeaders });
  }

  if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  }

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

  const { data: nativeTokens } = await supabase
    .from('native_push_tokens')
    .select('id, platform, token')
    .in('role', targetRoles)
    .eq('active', true);

  const location = request.locations?.name ?? 'Okänd plats';
  const typeLabel = REQUEST_TYPE_LABELS[requestType] ?? 'Ärende';
  const items = request.restock_request_items
    ?.map((item: { quantity: number; product_name: string }) => `${item.quantity}× ${item.product_name}`)
    .join(', ') ?? '';

  const title = request.priority === 'akut' ? `AKUT! ${typeLabel} - ${location}` : `${typeLabel} - ${location}`;
  const body = items || 'Nytt ärende väntar.';
  const urgent = request.priority === 'akut';

  const payload = JSON.stringify({
    title,
    body,
    tag: request.id,
    url: '/',
    requireInteraction: urgent,
  });

  const webResults = await Promise.allSettled((vapidPublicKey && vapidPrivateKey ? subscriptions ?? [] : []).map(async subscription => {
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

  const nativeResults = await Promise.allSettled((nativeTokens ?? []).map(async (nativeToken: NativePushToken) => {
    try {
      const result = nativeToken.platform === 'ios'
        ? await sendApnsNotification(nativeToken.token, { title, body, tag: request.id, urgent })
        : await sendFcmNotification(nativeToken.token, { title, body, tag: request.id, urgent });

      if (result === 'inactive') {
        await supabase
          .from('native_push_tokens')
          .update({ active: false })
          .eq('id', nativeToken.id);
        return false;
      }

      return result === 'sent';
    } catch {
      return false;
    }
  }));

  return Response.json({
    sent: [
      ...webResults,
      ...nativeResults,
    ].filter(result => result.status === 'fulfilled' && result.value).length,
    attempted: (vapidPublicKey && vapidPrivateKey ? subscriptions?.length ?? 0 : 0) + (nativeTokens?.length ?? 0),
    web_attempted: vapidPublicKey && vapidPrivateKey ? subscriptions?.length ?? 0 : 0,
    native_attempted: nativeTokens?.length ?? 0,
  }, { headers: corsHeaders });
});
