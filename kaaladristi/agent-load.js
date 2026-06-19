// agent-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const ttft = new Trend('time_to_response_ms');
const failures = new Rate('failed_requests');

export const options = {
  scenarios: {
    agent_ramp: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 3 },   // warm up to 3 concurrent
        { duration: '3m', target: 3 },    // hold — find steady state
        { duration: '1m', target: 5 },    // step to 5
        { duration: '3m', target: 5 },    // hold
        { duration: '1m', target: 8 },    // step to 8
        { duration: '3m', target: 8 },    // hold — likely the breaking zone
        { duration: '1m', target: 0 },    // ramp down
      ],
    },
  },
  thresholds: {
    failed_requests: ['rate<0.05'],            // fail if >5% error
    time_to_response_ms: ['p(95)<30000'],      // p95 under 30s
  },
};

const ENDPOINT = 'https://llm.dristiq.com/v1/chat/completions';

const payload = JSON.stringify({
  model: 'qwen3:4b',
  messages: [
    { role: 'user', content: '/no_think Generate a detailed 1500-word technical analysis with numbered sections on distributed systems design.' },
  ],
  max_tokens: 2000,
});

export default function () {
  const params = {
    headers: { 'Content-Type': 'application/json' },
    timeout: '120s',  // matches your nginx 120s proxy timeout for CPU inference
  };

  const start = Date.now();
  const res = http.post(ENDPOINT, payload, params);
  ttft.add(Date.now() - start);

  const ok = check(res, {
    'status 200': (r) => r.status === 200,
    'has content': (r) => r.body && r.body.length > 50,
  });
  failures.add(!ok);

  sleep(1);
}