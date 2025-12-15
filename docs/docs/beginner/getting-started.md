---
sidebar_position: 5
title: 시작하기
description: 첫 번째 OpenTelemetry 애플리케이션을 만들어봅니다
---

# OpenTelemetry 시작하기

이 가이드에서는 간단한 애플리케이션에 OpenTelemetry를 적용하고 Jaeger에서 트레이스를 확인합니다.

## 사전 요구사항

- Docker & Docker Compose
- Node.js 18+ 또는 Python 3.8+ 또는 Java 11+

## Quick Start with Docker

가장 빠른 시작 방법은 Docker Compose를 사용하는 것입니다.

### 1. 프로젝트 구조 생성

```bash
mkdir otel-quickstart && cd otel-quickstart
```

### 2. Docker Compose 파일 생성

```yaml
# docker-compose.yml
version: '3.8'

services:
  # Jaeger - 분산 추적 시각화
  jaeger:
    image: jaegertracing/all-in-one:1.53
    ports:
      - "16686:16686"  # Jaeger UI
      - "4317:4317"    # OTLP gRPC
      - "4318:4318"    # OTLP HTTP
    environment:
      - COLLECTOR_OTLP_ENABLED=true

  # OTel Collector (선택사항)
  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.91.0
    command: ["--config=/etc/otel-collector-config.yaml"]
    volumes:
      - ./otel-collector-config.yaml:/etc/otel-collector-config.yaml
    ports:
      - "4317:4317"   # OTLP gRPC
      - "4318:4318"   # OTLP HTTP
      - "8889:8889"   # Prometheus metrics
    depends_on:
      - jaeger
```

### 3. Collector 설정 파일 (선택사항)

```yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 1s
    send_batch_size: 1024

exporters:
  otlp:
    endpoint: jaeger:4317
    tls:
      insecure: true

  logging:
    verbosity: detailed

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp, logging]
```

### 4. 실행

```bash
docker-compose up -d
```

Jaeger UI 접속: http://localhost:16686

## Node.js 예제

### 설치

```bash
npm init -y
npm install express
npm install @opentelemetry/api \
            @opentelemetry/sdk-node \
            @opentelemetry/auto-instrumentations-node \
            @opentelemetry/exporter-trace-otlp-grpc
```

### 트레이싱 설정 (tracing.js)

```javascript
// tracing.js
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'my-nodejs-service',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  }),
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4317',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.log('Error terminating tracing', error))
    .finally(() => process.exit(0));
});
```

### 애플리케이션 (app.js)

```javascript
// app.js
require('./tracing'); // 반드시 먼저 import

const express = require('express');
const { trace } = require('@opentelemetry/api');

const app = express();
const tracer = trace.getTracer('my-nodejs-service');

app.get('/', (req, res) => {
  res.send('Hello OpenTelemetry!');
});

app.get('/api/users', async (req, res) => {
  // 수동 Span 생성
  const span = tracer.startSpan('fetch-users');

  try {
    // 비즈니스 로직
    span.setAttribute('users.count', 5);

    // 중첩 Span
    const dbSpan = tracer.startSpan('db-query', {
      attributes: { 'db.system': 'postgresql' }
    });

    // DB 쿼리 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 100));

    dbSpan.end();

    res.json({ users: ['Alice', 'Bob', 'Charlie'] });
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });
    res.status(500).json({ error: error.message });
  } finally {
    span.end();
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

### 실행

```bash
node app.js
```

브라우저에서 http://localhost:3000/api/users 접속 후 Jaeger UI에서 트레이스 확인

## Python 예제

### 설치

```bash
pip install flask
pip install opentelemetry-api \
            opentelemetry-sdk \
            opentelemetry-exporter-otlp \
            opentelemetry-instrumentation-flask
```

### 애플리케이션 (app.py)

```python
# app.py
from flask import Flask, jsonify
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
from opentelemetry.instrumentation.flask import FlaskInstrumentor
import time

# 리소스 설정
resource = Resource.create({
    SERVICE_NAME: "my-python-service",
    SERVICE_VERSION: "1.0.0"
})

# Tracer Provider 설정
provider = TracerProvider(resource=resource)
processor = BatchSpanProcessor(
    OTLPSpanExporter(endpoint="http://localhost:4317", insecure=True)
)
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)

# Tracer 가져오기
tracer = trace.get_tracer(__name__)

# Flask 앱 생성
app = Flask(__name__)

# 자동 계측
FlaskInstrumentor().instrument_app(app)

@app.route('/')
def hello():
    return 'Hello OpenTelemetry!'

@app.route('/api/orders')
def get_orders():
    # 수동 Span 생성
    with tracer.start_as_current_span("process-orders") as span:
        span.set_attribute("orders.count", 3)

        # 중첩 Span - DB 쿼리
        with tracer.start_as_current_span("db-query") as db_span:
            db_span.set_attribute("db.system", "postgresql")
            db_span.set_attribute("db.statement", "SELECT * FROM orders")
            time.sleep(0.1)  # 시뮬레이션

        # 중첩 Span - 캐시 조회
        with tracer.start_as_current_span("cache-lookup") as cache_span:
            cache_span.set_attribute("cache.hit", True)
            time.sleep(0.02)

        return jsonify({
            "orders": [
                {"id": 1, "item": "Widget"},
                {"id": 2, "item": "Gadget"},
                {"id": 3, "item": "Gizmo"}
            ]
        })

@app.route('/api/error')
def trigger_error():
    with tracer.start_as_current_span("error-operation") as span:
        try:
            raise ValueError("Something went wrong!")
        except Exception as e:
            span.record_exception(e)
            span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
            return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

### 실행

```bash
python app.py
```

## Java 예제

### Maven 의존성 (pom.xml)

```xml
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
        <version>3.2.0</version>
    </dependency>
    <dependency>
        <groupId>io.opentelemetry</groupId>
        <artifactId>opentelemetry-api</artifactId>
        <version>1.33.0</version>
    </dependency>
    <dependency>
        <groupId>io.opentelemetry</groupId>
        <artifactId>opentelemetry-sdk</artifactId>
        <version>1.33.0</version>
    </dependency>
    <dependency>
        <groupId>io.opentelemetry</groupId>
        <artifactId>opentelemetry-exporter-otlp</artifactId>
        <version>1.33.0</version>
    </dependency>
</dependencies>
```

### Auto-Instrumentation 사용 (권장)

```bash
# Java Agent 다운로드
curl -L -O https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar

# 실행
java -javaagent:opentelemetry-javaagent.jar \
     -Dotel.service.name=my-java-service \
     -Dotel.exporter.otlp.endpoint=http://localhost:4317 \
     -jar myapp.jar
```

## 트레이스 확인하기

### Jaeger UI

1. http://localhost:16686 접속
2. Service 드롭다운에서 서비스 선택
3. "Find Traces" 클릭
4. 트레이스 클릭하여 상세 보기

```
┌─────────────────────────────────────────────────────────────────┐
│                      Jaeger UI                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Search                                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Service: [my-nodejs-service ▼]                          │   │
│  │ Operation: [All ▼]                                      │   │
│  │ Lookback: [Last Hour ▼]                                 │   │
│  │                               [Find Traces]             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Results                                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ● my-nodejs-service: GET /api/users                     │   │
│  │   Duration: 125ms | Spans: 3                            │   │
│  │   12:30:45 PM                                           │   │
│  │                                                          │   │
│  │ ● my-nodejs-service: GET /                              │   │
│  │   Duration: 5ms | Spans: 1                              │   │
│  │   12:30:40 PM                                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 환경 변수로 설정

코드 변경 없이 환경 변수로 OTel 설정:

```bash
export OTEL_SERVICE_NAME=my-service
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_TRACES_EXPORTER=otlp
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_RESOURCE_ATTRIBUTES=deployment.environment=development,service.version=1.0.0
```

## 문제 해결

### 트레이스가 보이지 않는 경우

1. **Collector/Jaeger 연결 확인**
   ```bash
   curl -v http://localhost:4317
   ```

2. **SDK 초기화 확인**
   - 코드 시작 부분에서 SDK가 초기화되는지 확인

3. **콘솔 Exporter로 디버깅**
   ```javascript
   // Node.js
   const { ConsoleSpanExporter } = require('@opentelemetry/sdk-trace-base');
   ```

4. **로그 확인**
   ```bash
   docker-compose logs otel-collector
   docker-compose logs jaeger
   ```

## 다음 단계

기본 설정을 완료했다면:
- [OTel Collector 상세](../intermediate/collector) - Collector 심화 학습
- [계측 방법](../intermediate/instrumentation) - 다양한 계측 전략
- [Docker Compose 실습](../practical/docker-compose-setup) - 전체 스택 구성
