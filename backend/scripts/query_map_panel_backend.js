import { spawn } from 'child_process';
import WebSocket from 'ws';
import http from 'http';
import dotenv from 'dotenv';
import Employee from '../src/models/Employee.js';

dotenv.config();

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const debugPort = 9222;

function putJsonNew(url) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'PUT' }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('Spawning Chrome...');
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless',
    `--remote-debugging-port=${debugPort}`,
    '--window-size=1280,800',
    '--disable-gpu',
    '--no-sandbox'
  ]);

  await wait(2000);

  const target = await putJsonNew('http://localhost:4173/login/admin');
  const ws = new WebSocket(target.webSocketDebuggerUrl);

  let id = 1;
  const callbacks = new Map();

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg.result);
      callbacks.delete(msg.id);
    }
  });

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = id++;
      callbacks.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  await new Promise(r => ws.on('open', r));
  await send('Page.enable');
  await send('Runtime.enable');

  console.log('Logging in as Admin...');
  await send('Runtime.evaluate', {
    expression: `(function() {
      const emailInput = document.querySelector('input[type="email"]');
      const passwordInput = document.querySelector('input[type="password"]');
      const form = document.querySelector('form');
      if (emailInput && passwordInput && form) {
        emailInput.value = 'admin@sharpkode.com';
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        passwordInput.value = 'Admin@SharpKode2026';
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
        form.dispatchEvent(new Event('submit', { bubbles: true }));
        return true;
      }
      return false;
    })()`,
    returnByValue: true
  });

  await wait(3000);

  console.log('Navigating to Field Operations...');
  await send('Page.navigate', { url: 'http://localhost:5173/field-operations' });
  await wait(5000);

  const mapInfo = await send('Runtime.evaluate', {
    expression: `(function() {
      const container = document.querySelector('.maplibregl-canvas-container');
      const canvas = document.querySelector('.maplibregl-canvas');
      const mapDiv = document.querySelector('.relative.h-full');
      const overlay = document.querySelector('.absolute.inset-0.z-10');
      
      return {
        containerRect: container ? container.getBoundingClientRect() : null,
        canvasRect: canvas ? canvas.getBoundingClientRect() : null,
        canvasWidth: canvas ? canvas.width : null,
        canvasHeight: canvas ? canvas.height : null,
        mapDivRect: mapDiv ? mapDiv.getBoundingClientRect() : null,
        overlayText: overlay ? overlay.innerText : null
      };
    })()`,
    returnByValue: true
  });

  console.log('Map DOM info:', JSON.stringify(mapInfo.result.value, null, 2));

  ws.close();
  chromeProcess.kill();
}

run().catch(console.error);
