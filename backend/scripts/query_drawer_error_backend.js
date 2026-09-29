import { spawn } from 'child_process';
import WebSocket from 'ws';
import http from 'http';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const debugPort = 9222;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function putJsonNew(urlQuery) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port: debugPort,
      path: '/json/new?' + urlQuery,
      method: 'PUT'
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse: ' + data));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('Spawning Chrome...');
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless',
    `--remote-debugging-port=${debugPort}`,
    '--window-size=1280,800',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-setuid-sandbox'
  ]);

  await wait(2000);

  let targets;
  try {
    targets = await putJsonNew('http://localhost:4173/login/admin');
  } catch (err) {
    console.error('Failed to create new page in Chrome:', err.message);
    chromeProcess.kill();
    process.exit(1);
  }

  const webSocketDebuggerUrl = targets.webSocketDebuggerUrl;
  const ws = new WebSocket(webSocketDebuggerUrl);
  let id = 1;

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = id++;
      const onMessage = (data) => {
        const res = JSON.parse(data);
        if (res.id === msgId) {
          ws.off('message', onMessage);
          resolve(res.result);
        }
      };
      ws.on('message', onMessage);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.on('open', async () => {
    await send('Page.enable');
    await send('Runtime.enable');

    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const type = msg.params.type;
        const args = msg.params.args.map(a => a.value !== undefined ? a.value : (a.description || JSON.stringify(a)));
        console.log(`[CONSOLE] [${type.toUpperCase()}]`, ...args);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        console.error('[EXCEPTION]', JSON.stringify(msg.params.exceptionDetails, null, 2));
      }
    });

    console.log('Waiting for login page load...');
    await wait(3000);

    console.log('Entering credentials...');
    const loginScript = `
      (function() {
        const emailInput = document.querySelector('#login-email') || document.querySelector('input[type="email"]');
        const passwordInput = document.querySelector('#login-password') || document.querySelector('input[type="password"]');
        if (!emailInput || !passwordInput) return "Form inputs not found";
        
        function setReactValue(input, val) {
          const lastValue = input.value;
          input.value = val;
          const tracker = input._valueTracker;
          if (tracker) {
            tracker.setValue(lastValue);
          }
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        setReactValue(emailInput, "admin@sharpkode.com");
        setReactValue(passwordInput, "Admin@SharpKode2026");
        
        const submitBtn = document.querySelector('button[type="submit"]') || document.querySelector('button');
        if (!submitBtn) return "Submit button not found";
        
        submitBtn.click();
        return "Login click triggered";
      })()
    `;
    await send('Runtime.evaluate', { expression: loginScript });

    let token = null;
    for (let i = 0; i < 20; i++) {
      await wait(500);
      const tokenCheck = await send('Runtime.evaluate', { expression: 'localStorage.getItem("token")' });
      token = tokenCheck?.result?.value;
      if (token) {
        break;
      }
    }

    if (!token) {
      console.error('Failed to obtain token');
      ws.close();
      chromeProcess.kill();
      process.exit(1);
    }

    console.log('Navigating to Field Operations...');
    await send('Page.navigate', { url: 'http://localhost:4173/field-operations' });

    console.log('Waiting 5 seconds for employee list...');
    await wait(5000);

    console.log('Clicking employee card...');
    const clickScript = `
      (function() {
        // Find buttons that render in the sidebar (matching item.employee.name)
        const buttons = Array.from(document.querySelectorAll('button'));
        const employeeButton = buttons.find(btn => btn.innerText.includes('rasheed'));
        if (employeeButton) {
          employeeButton.click();
          return "Clicked employee card successfully";
        }
        return "Employee card not found";
      })()
    `;
    const clickRes = await send('Runtime.evaluate', { expression: clickScript });
    console.log('Click result:', clickRes?.result?.value);

    console.log('Waiting 6 seconds for exception to fire...');
    await wait(6000);

    console.log('Closing WebSocket and Chrome...');
    ws.close();
    chromeProcess.kill();
  });
}

run().catch(console.error);
