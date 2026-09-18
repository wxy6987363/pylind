// functions/api/visits.js
export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;

  // GET 请求：记录访问量（按日）
  if (method === 'GET') {
    return handleGet(env);
  }

  // POST 请求：获取访问量（同源校验）
  if (method === 'POST') {
    return handlePost(request, env);
  }

  return new Response('Method Not Allowed', { status: 405 });
}

// 处理 GET：存储访问量
async function handleGet(env) {
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const key = `visits:${today}`;

    let count = await env.KV.get(key);
    count = count ? parseInt(count, 10) : 0;

    count += 1;
    await env.KV.put(key, count.toString());

    return new Response(
      JSON.stringify({ date: today, count }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Failed to record visit', message: err.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// 处理 POST：获取访问量（同源校验）
async function handlePost(request, env) {
  // 同源校验：检查 Origin 或 Referer 是否与请求 Host 一致
  const origin = request.headers.get('Origin');
  const referer = request.headers.get('Referer');
  const host = request.headers.get('Host');

  const sameOrigin =
    (origin && new URL(origin).host === host) ||
    (referer && new URL(referer).host === host);

  if (!sameOrigin) {
    return new Response(
      JSON.stringify({ error: 'Forbidden: cross-origin request' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    let body = {};
    try {
      body = await request.json();
    } catch (e) {
      // 没有 body 或不是 JSON，忽略
    }

    const { date, startDate, endDate } = body;

    // 情况 1：查询单日
    if (date) {
      const key = `visits:${date}`;
      const count = await env.KV.get(key);
      return new Response(
        JSON.stringify({ date, count: count ? parseInt(count, 10) : 0 }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 情况 2：查询日期范围
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const results = [];

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayStr = d.toISOString().slice(0, 10);
        const key = `visits:${dayStr}`;
        const count = await env.KV.get(key);
        results.push({ date: dayStr, count: count ? parseInt(count, 10) : 0 });
      }

      return new Response(
        JSON.stringify({ results }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 情况 3：查询所有
    const list = await env.KV.list({ prefix: 'visits:' });
    const results = [];

    for (const key of list.keys) {
      const count = await env.KV.get(key.name);
      const date = key.name.replace('visits:', '');
      results.push({ date, count: count ? parseInt(count, 10) : 0 });
    }

    results.sort((a, b) => a.date.localeCompare(b.date));

    return new Response(
      JSON.stringify({ results }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Failed to get visits', message: err.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
