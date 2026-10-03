(async function () {
  const button = document.getElementById('offline-toggle');
  if (!button) return;
  if (!('serviceWorker' in navigator) || !('DecompressionStream' in window)) { button.disabled = true; button.title = '此浏览器不支持离线阅读，请使用支持 Service Worker 和 gzip 解压的浏览器'; return; }
  let busy = false;
  let enabled = false;
  function render(s) { enabled = !!s; button.textContent = enabled ? '切回在线模式' : '启用离线模式'; button.setAttribute('aria-pressed', String(enabled)); }
  try {
    const registration = await navigator.serviceWorker.register('/offline/sw.js', { scope: '/', updateViaCache: 'none' });
    await navigator.serviceWorker.ready;
    function send(type) {
      return new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = e => { channel.port1.close(); e.data.ok ? resolve(e.data.state) : reject(Error(e.data.error)); };
        (navigator.serviceWorker.controller || registration.active).postMessage({ type }, [channel.port2]);
      });
    }
    navigator.serviceWorker.addEventListener('message', async e => {
      if (e.data.type !== 'offline-state') return;
      if (e.data.reason === 'updated') { sessionStorage.setItem('offline-updated', '1'); location.reload(); }
      else render(await send('state'));
    });
    render(await send('check'));
    if (sessionStorage.getItem('offline-updated')) { sessionStorage.removeItem('offline-updated'); alert('博客已更新，离线缓存已失效，已切回在线模式。可重新启用离线模式获取最新内容。'); }
    button.addEventListener('click', async () => {
      if (busy) return;
      busy = true; button.disabled = true;
      const action = enabled ? 'disable' : 'enable';
      button.textContent = enabled ? '正在切回在线模式…' : '正在下载并解包…';
      try {
        await send(action);
        if (action === 'enable') await navigator.storage?.persist?.();
        location.reload();
      } catch (error) { alert(error.message || '离线模式操作失败，请检查网络和存储空间'); render(await send('state')); }
      finally { busy = false; button.disabled = false; }
    });
    const check = () => { if (!busy && navigator.onLine) send('check').then(render).catch(() => {}); };
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    setInterval(check, 60000);
  } catch { button.disabled = true; button.title = '无法启动离线阅读，请使用 HTTPS 并允许浏览器存储'; }
})();
