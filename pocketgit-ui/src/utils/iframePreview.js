const MESSAGE_SOURCE = 'pocketgit-preview';

export function buildPreviewDocument(htmlContent = '') {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 1rem; }
    pre { white-space: pre-wrap; word-break: break-word; }
  </style>
</head>
<body>
${htmlContent}
<script>
(function() {
  const source = '${MESSAGE_SOURCE}';
  function send(method, args) {
    try {
      const formatted = (args || []).map((arg) => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch (err) {
            return '[object]';
          }
        }
        return String(arg);
      });
      parent.postMessage({ source, type: 'console', method, args: formatted }, '*');
    } catch (err) {
      parent.postMessage({ source, type: 'console', method: 'error', args: [err.message] }, '*');
    }
  }
  ['log', 'info', 'warn', 'error', 'debug'].forEach((method) => {
    const original = console[method];
    console[method] = function(...args) {
      send(method, args);
      if (original) {
        original.apply(console, args);
      }
    };
  });
  const originalClear = console.clear;
  console.clear = function(...args) {
    send('clear', []);
    if (originalClear) {
      originalClear.apply(console, args);
    }
  };
  window.addEventListener('message', (event) => {
    if (!event.data || event.data.source !== source || event.data.type !== 'run-script') {
      return;
    }
    try {
      const result = eval(event.data.code);
      if (typeof result !== 'undefined') {
        send('result', [result]);
      }
    } catch (err) {
      send('error', [err.message]);
    }
  });
})();
</script>
</body>
</html>`;
}

export function attachConsoleListener(handler) {
  const listener = (event) => {
    if (!event.data || event.data.source !== MESSAGE_SOURCE || event.data.type !== 'console') {
      return;
    }
    handler(event.data);
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}

export function sendScriptToIframe(iframe, code) {
  if (!iframe || !iframe.contentWindow) return;
  iframe.contentWindow.postMessage({ source: MESSAGE_SOURCE, type: 'run-script', code }, '*');
}
