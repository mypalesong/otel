---
sidebar_position: 5
title: 계측 (Instrumentation)
description: 애플리케이션에 OpenTelemetry 계측을 적용하는 다양한 방법을 알아봅니다
---

# 계측 (Instrumentation)

## 계측이란?

**계측(Instrumentation)**은 애플리케이션에서 텔레메트리 데이터(traces, metrics, logs)를 생성하도록 코드를 추가하는 과정입니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Instrumentation Types                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 자동 계측 (Automatic)                    │   │
│  │  • Zero-code / Low-code                                  │   │
│  │  • Agent 또는 라이브러리가 자동 계측                     │   │
│  │  • 일반적인 프레임워크/라이브러리 지원                   │   │
│  │  • 빠른 시작, 제한된 커스터마이징                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 수동 계측 (Manual)                       │   │
│  │  • 직접 OTel API 사용                                    │   │
│  │  • 비즈니스 로직 계측 가능                               │   │
│  │  • 완전한 제어                                           │   │
│  │  • 더 많은 코드 필요                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  권장: 자동 계측 + 수동 계측 병행                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 자동 계측 (Auto-Instrumentation)

### Java Auto-Instrumentation

#### Agent 방식 (Zero-Code)

```bash
# Agent 다운로드
curl -L -O https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar

# 실행
java -javaagent:opentelemetry-javaagent.jar \
     -Dotel.service.name=my-java-service \
     -Dotel.exporter.otlp.endpoint=http://collector:4317 \
     -jar myapp.jar
```

#### 환경 변수로 설정

```bash
export OTEL_SERVICE_NAME=order-service
export OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4317
export OTEL_TRACES_EXPORTER=otlp
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production,service.version=1.0.0

java -javaagent:opentelemetry-javaagent.jar -jar myapp.jar
```

#### 지원 라이브러리

| 카테고리 | 라이브러리 |
|----------|-----------|
| Web Frameworks | Spring MVC, Spring WebFlux, JAX-RS, Servlet |
| HTTP Clients | HttpURLConnection, Apache HttpClient, OkHttp |
| Database | JDBC, Hibernate, MyBatis |
| Messaging | Kafka, RabbitMQ, JMS |
| RPC | gRPC |
| Caching | Redis, Memcached |

### Python Auto-Instrumentation

#### 설치

```bash
pip install opentelemetry-distro opentelemetry-exporter-otlp
opentelemetry-bootstrap -a install
```

#### 실행

```bash
opentelemetry-instrument \
    --service_name=my-python-service \
    --exporter_otlp_endpoint=http://collector:4317 \
    python app.py
```

#### 또는 코드 내 설정

```python
# instrumentation.py
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource, SERVICE_NAME
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

def configure_opentelemetry():
    resource = Resource.create({SERVICE_NAME: "my-python-service"})
    provider = TracerProvider(resource=resource)
    processor = BatchSpanProcessor(OTLPSpanExporter())
    provider.add_span_processor(processor)
    trace.set_tracer_provider(provider)

    # 자동 계측 활성화
    FlaskInstrumentor().instrument()
    RequestsInstrumentor().instrument()
    SQLAlchemyInstrumentor().instrument()
```

### Node.js Auto-Instrumentation

#### 설치

```bash
npm install @opentelemetry/sdk-node \
            @opentelemetry/auto-instrumentations-node \
            @opentelemetry/exporter-trace-otlp-grpc
```

#### 설정 파일

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
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: 'production',
  }),
  traceExporter: new OTLPTraceExporter({
    url: 'http://collector:4317',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // 선택적 설정
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingPaths: ['/health', '/ready'],
      },
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // 파일시스템 계측 비활성화
      },
    }),
  ],
});

sdk.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.error('Error terminating tracing', error))
    .finally(() => process.exit(0));
});
```

#### 실행

```bash
node -r ./tracing.js app.js
```

### Go Auto-Instrumentation

Go는 컴파일 언어 특성상 완전 자동 계측이 어렵습니다. 대신 instrumentation 라이브러리 사용:

```go
package main

import (
    "net/http"

    "go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
    "go.opentelemetry.io/otel/sdk/resource"
    sdktrace "go.opentelemetry.io/otel/sdk/trace"
    semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
)

func initTracer() func() {
    exporter, _ := otlptracegrpc.New(context.Background())

    res, _ := resource.Merge(
        resource.Default(),
        resource.NewWithAttributes(
            semconv.SchemaURL,
            semconv.ServiceName("my-go-service"),
            semconv.ServiceVersion("1.0.0"),
        ),
    )

    tp := sdktrace.NewTracerProvider(
        sdktrace.WithBatcher(exporter),
        sdktrace.WithResource(res),
    )
    otel.SetTracerProvider(tp)

    return func() { tp.Shutdown(context.Background()) }
}

func main() {
    shutdown := initTracer()
    defer shutdown()

    // HTTP 핸들러 계측
    handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Write([]byte("Hello!"))
    })

    wrappedHandler := otelhttp.NewHandler(handler, "my-handler")
    http.ListenAndServe(":8080", wrappedHandler)
}
```

## 수동 계측 (Manual Instrumentation)

### 기본 Span 생성

```python
# Python
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

def process_order(order_id: str):
    with tracer.start_as_current_span("process-order") as span:
        # 속성 추가
        span.set_attribute("order.id", order_id)
        span.set_attribute("order.type", "standard")

        # 비즈니스 로직
        validate_order(order_id)
        charge_payment(order_id)

        span.set_status(trace.Status(trace.StatusCode.OK))
```

```javascript
// Node.js
const { trace } = require('@opentelemetry/api');

const tracer = trace.getTracer('order-service');

async function processOrder(orderId) {
  const span = tracer.startSpan('process-order');

  try {
    span.setAttribute('order.id', orderId);
    span.setAttribute('order.type', 'standard');

    await validateOrder(orderId);
    await chargePayment(orderId);

    span.setStatus({ code: SpanStatusCode.OK });
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    throw error;
  } finally {
    span.end();
  }
}
```

```java
// Java
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.context.Scope;

@Autowired
private Tracer tracer;

public void processOrder(String orderId) {
    Span span = tracer.spanBuilder("process-order").startSpan();

    try (Scope scope = span.makeCurrent()) {
        span.setAttribute("order.id", orderId);
        span.setAttribute("order.type", "standard");

        validateOrder(orderId);
        chargePayment(orderId);

        span.setStatus(StatusCode.OK);
    } catch (Exception e) {
        span.recordException(e);
        span.setStatus(StatusCode.ERROR, e.getMessage());
        throw e;
    } finally {
        span.end();
    }
}
```

### 중첩 Span

```python
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

def process_order(order_id: str):
    with tracer.start_as_current_span("process-order") as parent_span:
        parent_span.set_attribute("order.id", order_id)

        # 자동으로 부모-자식 관계 설정
        with tracer.start_as_current_span("validate-order") as validate_span:
            validate_span.set_attribute("validation.type", "full")
            do_validation()

        with tracer.start_as_current_span("process-payment") as payment_span:
            payment_span.set_attribute("payment.method", "credit_card")

            # 더 깊은 중첩
            with tracer.start_as_current_span("call-payment-gateway"):
                call_external_gateway()
```

### 이벤트와 예외 기록

```python
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

def process_payment(order_id: str, amount: float):
    with tracer.start_as_current_span("process-payment") as span:
        span.set_attribute("payment.amount", amount)

        # 이벤트 기록
        span.add_event("payment_initiated", {
            "payment.gateway": "stripe",
            "payment.method": "credit_card"
        })

        try:
            result = call_payment_gateway(amount)

            span.add_event("payment_completed", {
                "transaction.id": result.transaction_id
            })

        except PaymentFailedException as e:
            # 예외 기록
            span.record_exception(e)
            span.set_status(trace.Status(
                trace.StatusCode.ERROR,
                "Payment failed"
            ))
            span.add_event("payment_failed", {
                "error.reason": str(e)
            })
            raise
```

### 컨텍스트 명시적 전달

```python
from opentelemetry import trace
from opentelemetry.trace import set_span_in_context
from opentelemetry.context import attach, detach

tracer = trace.get_tracer(__name__)

def main():
    with tracer.start_as_current_span("main") as main_span:
        # 현재 컨텍스트 가져오기
        ctx = set_span_in_context(main_span)

        # 다른 스레드나 비동기 작업에 전달
        process_async(ctx)

def process_async(context):
    token = attach(context)
    try:
        with tracer.start_as_current_span("async-operation"):
            # 부모 span과 연결됨
            do_work()
    finally:
        detach(token)
```

## Semantic Conventions

표준화된 속성 이름 사용:

```python
from opentelemetry.semconv.trace import SpanAttributes

with tracer.start_as_current_span("http-request") as span:
    # Semantic Conventions 사용 (권장)
    span.set_attribute(SpanAttributes.HTTP_METHOD, "POST")
    span.set_attribute(SpanAttributes.HTTP_URL, "https://api.example.com/orders")
    span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, 200)
    span.set_attribute(SpanAttributes.HTTP_REQUEST_CONTENT_LENGTH, 1024)

    # 데이터베이스
    span.set_attribute(SpanAttributes.DB_SYSTEM, "postgresql")
    span.set_attribute(SpanAttributes.DB_STATEMENT, "SELECT * FROM orders")
    span.set_attribute(SpanAttributes.DB_OPERATION, "SELECT")

    # 메시징
    span.set_attribute(SpanAttributes.MESSAGING_SYSTEM, "kafka")
    span.set_attribute(SpanAttributes.MESSAGING_DESTINATION, "orders-topic")
```

### 주요 Semantic Conventions

| 카테고리 | 속성 예시 |
|----------|----------|
| HTTP | `http.method`, `http.url`, `http.status_code` |
| Database | `db.system`, `db.statement`, `db.operation` |
| Messaging | `messaging.system`, `messaging.destination` |
| RPC | `rpc.system`, `rpc.method`, `rpc.service` |
| Exception | `exception.type`, `exception.message`, `exception.stacktrace` |

## 계측 모범 사례

### 1. 의미 있는 Span 이름

```python
# ❌ 나쁜 예
tracer.start_as_current_span("span1")
tracer.start_as_current_span("processData")

# ✅ 좋은 예
tracer.start_as_current_span("POST /api/orders")
tracer.start_as_current_span("order-service.process_order")
tracer.start_as_current_span("SELECT orders")
```

### 2. 적절한 속성 추가

```python
# ❌ 너무 적은 정보
span.set_attribute("id", order_id)

# ✅ 충분한 컨텍스트
span.set_attribute("order.id", order_id)
span.set_attribute("order.type", order_type)
span.set_attribute("customer.id", customer_id)
span.set_attribute("order.total_amount", total_amount)
```

### 3. 민감 정보 제외

```python
# ❌ 민감 정보 포함
span.set_attribute("user.password", password)
span.set_attribute("payment.card_number", card_number)

# ✅ 민감 정보 마스킹 또는 제외
span.set_attribute("user.id", user_id)
span.set_attribute("payment.card_last_four", card_number[-4:])
```

### 4. 에러 처리

```python
# ✅ 적절한 에러 처리
try:
    result = do_operation()
    span.set_status(trace.Status(trace.StatusCode.OK))
except Exception as e:
    span.record_exception(e)
    span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
    raise
```

## 다음 단계

- [Context Propagation](./context-propagation) - 서비스 간 컨텍스트 전파
- [MSA 아키텍처](../advanced/msa-architecture) - 마이크로서비스 환경 계측
