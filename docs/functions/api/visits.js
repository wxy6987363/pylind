// functions/api/visits.js
export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;

  // GET 请求：记录访问量（按日）
  if (method === 'GET') {
    return handleGet(env);
  }

  // POST 请求：获取访问量（需要验证 Token）
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

    // 从 KV 读取当前计数（如果没有则为 0）
    let count = await env.KV.get(key);
    count = count ? parseInt(count, 10) : 0;

    // 计数 +1 并写回
    count += 1;
    await env.KV.put(key, count.toString());

    return new Response(
      JSON.stringify({ date: today, count }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
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

// 处理 POST：获取访问量（需要 Token 验证）
async function handlePost(request, env) {
  // 验证 API_TOKEN
  const authHeader = request.headers.get('Authorization');
  const token = authHeader ? authHeader.replace('Bearer ', '') : null;

  if (!env.API_TOKEN || token !== env.API_TOKEN) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // 解析请求体，支持查询指定日期或日期范围
    let body = {};
    try {
      body = await request.json();
    } catch (e) {
      // 如果没有 body 或不是 JSON，忽略
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

    // 情况 3：查询所有（列出 KV 中所有 visits: 前缀的键）
    const list = await env.KV.list({ prefix: 'visits:' });
    const results = [];

    for (const key of list.keys) {
      const count = await env.KV.get(key.name);
      const date = key.name.replace('visits:', '');
      results.push({ date, count: count ? parseInt(count, 10) : 0 });
    }

    // 按日期排序
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
