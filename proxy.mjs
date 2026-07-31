#!/usr/bin/env node
// Local proxy in front of ANTHROPIC_BASE_URL. Some models behind the
// gen.ai.kku.ac.th gateway (e.g. deepseek-v4-pro via AtlasCloud) always
// reply with an SSE stream, even for non-streaming requests. Claude Code's
// model-switch check sends a non-streaming request and expects a flat JSON
// body with `usage.input_tokens` - getting SSE text instead crashes it.
// This proxy passes everything through untouched, except: when the client
// did not request streaming but the upstream response is SSE anyway, it
// buffers the stream and reassembles it into a normal Messages API JSON
// response.
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

const UPSTREAM = new URL(process.env.UPSTREAM_BASE_URL || 'https://gen.ai.kku.ac.th/api');
const LISTEN_PORT = process.env.PROXY_PORT ? Number(process.env.PROXY_PORT) : 4319;

function parseSSEToMessage(sseText) {
  let message = null;
  const blocks = new Map();
  let finalDelta = {};
  let finalUsage = null;

  function handleEvent(dataStr) {
    if (!dataStr) return;
    let data;
    try {
      data = JSON.parse(dataStr);
    } catch {
      return;
    }
    switch (data.type) {
      case 'message_start':
        message = data.message;
        break;
      case 'content_block_start': {
        const cb = data.content_block;
        blocks.set(data.index, {
          type: cb.type,
          text: '',
          thinking: '',
          signature: cb.signature || '',
          partial_json: '',
          id: cb.id,
          name: cb.name,
        });
        break;
      }
      case 'content_block_delta': {
        const b = blocks.get(data.index);
        if (!b) break;
        const d = data.delta;
        if (d.type === 'text_delta') b.text += d.text;
        else if (d.type === 'thinking_delta') b.thinking += d.thinking;
        else if (d.type === 'signature_delta') b.signature += d.signature;
        else if (d.type === 'input_json_delta') b.partial_json += d.partial_json;
        break;
      }
      case 'message_delta':
        finalDelta = data.delta || {};
        finalUsage = data.usage || finalUsage;
        break;
      default:
        break;
    }
  }

  let currentEvent = null;
  let dataBuf = '';
  for (const rawLine of sseText.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (line === '') {
      if (currentEvent !== null) handleEvent(dataBuf);
      currentEvent = null;
      dataBuf = '';
      continue;
    }
    if (line.startsWith('event:')) currentEvent = line.slice(6).trim();
    else if (line.startsWith('data:')) dataBuf += line.slice(5).trim();
  }
  if (currentEvent !== null && dataBuf) handleEvent(dataBuf);

  if (!message) return null;

  const content = [...blocks.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, b]) => {
      if (b.type === 'text') return { type: 'text', text: b.text };
      if (b.type === 'thinking') return { type: 'thinking', thinking: b.thinking, signature: b.signature };
      if (b.type === 'tool_use') {
        let input = {};
        try {
          input = b.partial_json ? JSON.parse(b.partial_json) : {};
        } catch {
          // leave input as {}
        }
        return { type: 'tool_use', id: b.id, name: b.name, input };
      }
      return { type: b.type };
    });

  return {
    id: message.id,
    type: 'message',
    role: message.role,
    model: message.model,
    content,
    stop_reason: finalDelta.stop_reason ?? message.stop_reason ?? null,
    stop_sequence: finalDelta.stop_sequence ?? message.stop_sequence ?? null,
    usage: finalUsage || message.usage || { input_tokens: 0, output_tokens: 0 },
  };
}

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const bodyBuf = Buffer.concat(chunks);
    const isMessagesPost = req.method === 'POST' && req.url.startsWith('/v1/messages');
    let wantsStream = false;
    if (isMessagesPost && bodyBuf.length) {
      try {
        wantsStream = JSON.parse(bodyBuf.toString('utf8')).stream === true;
      } catch {
        // malformed body, let upstream reject it
      }
    }

    const headers = { ...req.headers };
    delete headers.host;
    headers['accept-encoding'] = 'identity';
    headers['content-length'] = String(bodyBuf.length);

    const upstreamReq = https.request(
      {
        protocol: UPSTREAM.protocol,
        hostname: UPSTREAM.hostname,
        port: UPSTREAM.port || 443,
        path: UPSTREAM.pathname.replace(/\/$/, '') + req.url,
        method: req.method,
        headers,
      },
      (upstreamRes) => {
        const contentType = upstreamRes.headers['content-type'] || '';
        const isSSE = contentType.includes('text/event-stream');

        if (!isMessagesPost || wantsStream || !isSSE) {
          res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
          upstreamRes.pipe(res);
          return;
        }

        const dataChunks = [];
        upstreamRes.on('data', (c) => dataChunks.push(c));
        upstreamRes.on('end', () => {
          const text = Buffer.concat(dataChunks).toString('utf8');
          const message = parseSSEToMessage(text);
          if (!message) {
            res.writeHead(502, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: { type: 'proxy_error', message: 'failed to parse upstream SSE' } }));
            return;
          }
          const json = JSON.stringify(message);
          res.writeHead(upstreamRes.statusCode, {
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(json),
          });
          res.end(json);
        });
      },
    );

    upstreamReq.on('error', (err) => {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { type: 'proxy_error', message: String(err) } }));
    });

    upstreamReq.end(bodyBuf);
  });
});

server.listen(LISTEN_PORT, '127.0.0.1', () => {
  console.log(`patch-usage-proxy listening on http://127.0.0.1:${LISTEN_PORT} -> ${UPSTREAM.href}`);
});
