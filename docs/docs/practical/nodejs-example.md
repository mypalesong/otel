---
sidebar_position: 3
title: Node.js 예제
description: Node.js 애플리케이션의 상세한 OpenTelemetry 계측 예제
---

# Node.js 예제

## 프로젝트 설정

```bash
mkdir nodejs-otel-demo && cd nodejs-otel-demo
npm init -y
```

### 의존성 설치

```bash
npm install express axios

# OpenTelemetry 패키지
npm install @opentelemetry/api \
            @opentelemetry/sdk-node \
            @opentelemetry/auto-instrumentations-node \
            @opentelemetry/exporter-trace-otlp-grpc \
            @opentelemetry/exporter-metrics-otlp-grpc \
            @opentelemetry/sdk-metrics \
            @opentelemetry/resources \
            @opentelemetry/semantic-conventions
```

## 기본 설정

```javascript
// tracing.js
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-grpc');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'nodejs-service',
  [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
});

const sdk = new NodeSDK({
  resource,
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
    }),
    exportIntervalMillis: 10000,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingPaths: ['/health', '/ready', '/metrics'],
      },
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('SDK shut down successfully'))
    .catch((error) => console.error('Error shutting down SDK', error))
    .finally(() => process.exit(0));
});

module.exports = sdk;
```

## 애플리케이션 코드

```javascript
// app.js
require('./tracing'); // 반드시 첫 번째 import

const express = require('express');
const axios = require('axios');
const { trace, metrics, SpanStatusCode } = require('@opentelemetry/api');

const app = express();
app.use(express.json());

// Tracer와 Meter 가져오기
const tracer = trace.getTracer('nodejs-service');
const meter = metrics.getMeter('nodejs-service');

// 커스텀 메트릭 정의
const requestCounter = meter.createCounter('http_requests_total', {
  description: 'Total number of HTTP requests',
});

const activeRequests = meter.createUpDownCounter('http_active_requests', {
  description: 'Number of active HTTP requests',
});

const requestDuration = meter.createHistogram('http_request_duration_ms', {
  description: 'HTTP request duration in milliseconds',
  unit: 'ms',
});

// 미들웨어: 요청 메트릭
app.use((req, res, next) => {
  const startTime = Date.now();
  activeRequests.add(1, { method: req.method, path: req.path });

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    requestCounter.add(1, {
      method: req.method,
      path: req.path,
      status: res.statusCode,
    });
    requestDuration.record(duration, {
      method: req.method,
      path: req.path,
    });
    activeRequests.add(-1, { method: req.method, path: req.path });
  });

  next();
});

// 헬스체크
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// 사용자 API
app.get('/api/users/:id', async (req, res) => {
  // 수동 span 생성
  const span = tracer.startSpan('get-user', {
    attributes: {
      'user.id': req.params.id,
    },
  });

  try {
    // 중첩 span - DB 조회
    const user = await tracer.startActiveSpan('db-query', async (dbSpan) => {
      dbSpan.setAttribute('db.system', 'postgresql');
      dbSpan.setAttribute('db.operation', 'SELECT');
      dbSpan.setAttribute('db.statement', 'SELECT * FROM users WHERE id = ?');

      // 시뮬레이션된 DB 조회
      await sleep(Math.random() * 50 + 10);

      dbSpan.end();
      return {
        id: req.params.id,
        name: `User ${req.params.id}`,
        email: `user${req.params.id}@example.com`,
      };
    });

    span.setStatus({ code: SpanStatusCode.OK });
    res.json(user);
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    res.status(500).json({ error: error.message });
  } finally {
    span.end();
  }
});

// 주문 API (외부 서비스 호출)
app.post('/api/orders', async (req, res) => {
  const span = tracer.startSpan('create-order');

  try {
    span.setAttribute('order.items_count', req.body.items?.length || 0);

    // 1. 재고 확인
    await tracer.startActiveSpan('check-inventory', async (inventorySpan) => {
      inventorySpan.setAttribute('inventory.service', 'inventory-api');
      await sleep(30);
      inventorySpan.addEvent('inventory_checked', {
        'inventory.available': true,
      });
      inventorySpan.end();
    });

    // 2. 결제 처리
    const paymentResult = await tracer.startActiveSpan('process-payment', async (paymentSpan) => {
      paymentSpan.setAttribute('payment.method', req.body.paymentMethod || 'credit_card');

      // 외부 결제 서비스 호출
      try {
        // 실제로는 외부 API 호출
        await sleep(100);
        paymentSpan.addEvent('payment_completed', {
          'payment.transaction_id': `txn-${Date.now()}`,
        });
        paymentSpan.end();
        return { success: true, transactionId: `txn-${Date.now()}` };
      } catch (error) {
        paymentSpan.recordException(error);
        paymentSpan.setStatus({ code: SpanStatusCode.ERROR });
        paymentSpan.end();
        throw error;
      }
    });

    // 3. 주문 저장
    const order = await tracer.startActiveSpan('save-order', async (saveSpan) => {
      saveSpan.setAttribute('db.system', 'postgresql');
      saveSpan.setAttribute('db.operation', 'INSERT');
      await sleep(20);
      saveSpan.end();
      return {
        id: `order-${Date.now()}`,
        status: 'created',
        payment: paymentResult,
      };
    });

    span.setAttribute('order.id', order.id);
    span.setStatus({ code: SpanStatusCode.OK });
    res.status(201).json(order);
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    res.status(500).json({ error: error.message });
  } finally {
    span.end();
  }
});

// 외부 API 호출 예제
app.get('/api/external-data', async (req, res) => {
  const span = tracer.startSpan('fetch-external-data');

  try {
    // Context는 axios instrumentation에 의해 자동 전파됨
    const response = await axios.get('https://jsonplaceholder.typicode.com/posts/1');

    span.setAttribute('external.api', 'jsonplaceholder');
    span.setAttribute('external.status', response.status);
    span.setStatus({ code: SpanStatusCode.OK });

    res.json(response.data);
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    res.status(500).json({ error: error.message });
  } finally {
    span.end();
  }
});

// 배치 처리 예제
app.post('/api/batch-process', async (req, res) => {
  const items = req.body.items || [];

  const span = tracer.startSpan('batch-process', {
    attributes: {
      'batch.size': items.length,
    },
  });

  try {
    const results = await Promise.all(
      items.map((item, index) =>
        tracer.startActiveSpan(`process-item-${index}`, async (itemSpan) => {
          itemSpan.setAttribute('item.id', item.id);
          await sleep(Math.random() * 100);
          itemSpan.end();
          return { ...item, processed: true };
        })
      )
    );

    span.setAttribute('batch.processed', results.length);
    span.setStatus({ code: SpanStatusCode.OK });
    res.json({ results });
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    res.status(500).json({ error: error.message });
  } finally {
    span.end();
  }
});

// 유틸리티 함수
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## 실행

```bash
# 환경 변수 설정
export OTEL_SERVICE_NAME=my-nodejs-app
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317

# 실행
node app.js
```

## 테스트

```bash
# 사용자 조회
curl http://localhost:3000/api/users/123

# 주문 생성
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"items": [{"id": 1, "name": "Widget"}], "paymentMethod": "credit_card"}'

# 배치 처리
curl -X POST http://localhost:3000/api/batch-process \
  -H "Content-Type: application/json" \
  -d '{"items": [{"id": 1}, {"id": 2}, {"id": 3}]}'
```

## 다음 단계

- [Java 예제](./java-example) - Java 상세 계측
- [Python 예제](./python-example) - Python 상세 계측
