const { getStore } = require('@netlify/blobs');

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

exports.handler = async (event) => {
  // 处理跨域预检请求
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  try {
    const params = event.queryStringParameters || {};
    const action = params.action;
    const store = getStore('travelos-data');

    // ================= 1. 注册 =================
    if (action === 'register' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { username, password } = body;
      
      if (!username || !password) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: '用户名和密码不能为空' }) };
      }

      const users = (await store.get('users_db', { type: 'json' })) || {};
      if (users[username]) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: '该用户名已被注册' }) };
      }

      // 保存账号
      users[username] = password;
      await store.setJSON('users_db', users);

      // 初始化空数据
      const emptyData = {
        orders: [], messages: [], balance: 5000, cards: [], passengers: [], profile: { nickname: username, phone: '' }
      };
      await store.setJSON(`data_${username}`, emptyData);

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, message: '注册成功' }) };
    }

    // ================= 2. 登录 =================
    if (action === 'login' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { username, password } = body;

      const users = (await store.get('users_db', { type: 'json' })) || {};
      if (!users[username] || users[username] !== password) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: '用户名或密码错误' }) };
      }

      const data = (await store.get(`data_${username}`, { type: 'json' })) || {};
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, data }) };
    }

    // ================= 3. 同步推送 (Push) =================
    if (action === 'push' && event.httpMethod === 'POST') {
      const user = params.user;
      if (!user) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: '缺少用户标识' }) };

      const body = JSON.parse(event.body || '{}');
      await store.setJSON(`data_${user}`, body);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    }

    // ================= 4. 后台查询订单 =================
    if (action === 'admin_search' && event.httpMethod === 'GET') {
      const orderId = params.orderId;
      if (!orderId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: '缺少订单号' }) };

      // 遍历所有用户数据找订单（生产环境应建索引，这里简化）
      const users = (await store.get('users_db', { type: 'json' })) || {};
      for (const username of Object.keys(users)) {
        const data = await store.get(`data_${username}`, { type: 'json' });
        if (data && data.orders) {
          const order = data.orders.find(o => o.id === orderId);
          if (order) {
            return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, order, owner: username }) };
          }
        }
      }
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: '未找到该订单' }) };
    }

    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: '未知操作' }) };
  } catch (e) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }
};