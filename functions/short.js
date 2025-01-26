// 生成随机后缀的函数
function generateRandomSuffix(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function handleRequest(request, LINKS) {
  const url = new URL(request.url);
  let targetUrl;
  let customSuffix;

  // 检查请求方法，GET 或 POST
  if (request.method === 'GET') {
    targetUrl = url.searchParams.get('longUrl');  // 获取长链接
    customSuffix = url.searchParams.get('shortKey');  // 获取自定义后缀
  } else if (request.method === 'POST') {
    const formData = await request.formData();  // 解析表单数据
    targetUrl = formData.get('longUrl');  // 获取长链接
    customSuffix = formData.get('shortKey');  // 获取自定义后缀
  }

  // 如果没有传入目标URL，返回错误
  if (!targetUrl) {
    return new Response(JSON.stringify({
      Code : 201,
      Message: 'failed to get long URL, please check the short URL if exists or expired' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 将 Base64 编码的 longUrl 解码
  try {
    targetUrl = atob(targetUrl);  // 使用 atob 进行 Base64 解码
  } catch (error) {
    return new Response(JSON.stringify({
      Code : 201,
      Message: 'failed to decode long URL, please check if it is properly encoded' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 如果指定了自定义后缀，则使用它；否则生成一个随机后缀
  const suffix = customSuffix || generateRandomSuffix(6);  // 默认6位随机后缀

  // 获取当前 Worker 的域名
  const workerDomain = request.headers.get('host');  // 获取当前访问的域名

  // 检查 KV 存储中是否已存在该自定义后缀
  const existingUrl = await LINKS.get(suffix);
  if (existingUrl) {
    return new Response(JSON.stringify({
      Code : 201,
      Message: 'short key already exists, please use another one or leave it empty to generate automatically.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 构建短链接
  const shortLink = `https://${workerDomain}/${suffix}`;

  // 将短链接映射到目标URL，存储到 KV 存储
  await LINKS.put(suffix, targetUrl);

  return new Response(JSON.stringify({
    Code : 1,
    ShortUrl: shortLink
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleRedirect(request, LINKS) {
  const url = new URL(request.url);
  const suffix = url.pathname.split('/')[1];  // 获取短链接的后缀

  // 从 KV 存储中取出原始URL
  const targetUrl = await LINKS.get(suffix);

  if (targetUrl) {
    return Response.redirect(targetUrl, 301);  // 重定向到原始URL
  } else {
    return new Response('Short link not found', { status: 404 });
  }
}

// 修改事件监听器以适配 Pages
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    if (url.pathname === '/') {
      // 返回静态页面
      return new Response(INDEX_HTML, {
        headers: { 'Content-Type': 'text/html' },
      });
    } else if (url.pathname === '/short') {
      // 创建短链接
      return handleRequest(request, env.LINKS);
    } else if (url.pathname.startsWith('/')) {
      // 跳转到原始链接
      return handleRedirect(request, env.LINKS);
    } else {
      return new Response('Not Found', { status: 404 });
    }
  }
};
