---
sidebar_position: 3
title: 마이그레이션 가이드
description: 기존 관측성 도구에서 OpenTelemetry로 안전하게 전환하는 방법
---

# OpenTelemetry 마이그레이션 가이드

기존 관측성 도구에서 OpenTelemetry로 전환하는 것은 복잡할 수 있습니다. 이 가이드는 실제 기업들의 성공적인 마이그레이션 경험을 바탕으로 단계별 전환 방법을 제시합니다.

## 🗺️ 마이그레이션 경로 선택

### 출발점별 전환 전략

```
┌─────────────────────────────────────────────────────────────┐
│              마이그레이션 경로 맵                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  출발점                    경로                     목적지 │
│  ───────                   ────                    ─────── │
│                                                             │
│  OpenTracing    ──────▶  OTel Shim  ──────▶              │
│                                               ┌───────────┐│
│  OpenCensus     ──────▶  OTel Bridge ─────▶  │   Native  ││
│                                               │   OTel    ││
│  Jaeger Client  ──────▶  직접 마이그레이션 ▶  │   SDK     ││
│                                               └───────────┘│
│  Zipkin         ──────▶  Collector 전환 ──▶              │
│                                                             │
│  벤더 SDK       ──────▶  OTLP Export ─────▶              │
│  (DataDog 등)                                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 OpenTracing에서 마이그레이션

### Skyscanner 방식: Shim 활용

OpenTracing에서 OpenTelemetry로 가장 안전한 전환 방법입니다.

#### Step 1: Shim 라이브러리 설치

```bash
# Node.js
npm install @opentelemetry/shim-opentracing

# Java
# Maven
<dependency>
    <groupId>io.opentelemetry</groupId>
    <artifactId>opentelemetry-opentracing-shim</artifactId>
    <version>1.34.0</version>
</dependency>

# Python
pip install opentelemetry-opentracing-shim
```

#### Step 2: Shim 설정

```javascript
// Node.js - 기존 OpenTracing 코드 변경 없이 작동
const { TracerShim } = require('@opentelemetry/shim-opentracing');
const { trace } = require('@opentelemetry/api');

// OpenTelemetry 초기화 (기존 OTel 설정 사용)
const provider = new NodeTracerProvider();
provider.register();

// Shim 생성 - OpenTracing API가 OTel로 연결됨
const shim = new TracerShim(trace.getTracer('my-service'));

// 기존 OpenTracing 코드가 그대로 작동
const opentracing = require('opentracing');
opentracing.initGlobalTracer(shim);

// 기존 코드 변경 불필요!
const span = opentracing.globalTracer().startSpan('my-operation');
span.finish();
```

```java
// Java
import io.opentelemetry.opentracingshim.OpenTracingShim;
import io.opentracing.Tracer;

// OpenTelemetry SDK 초기화
SdkTracerProvider tracerProvider = SdkTracerProvider.builder()
    .addSpanProcessor(BatchSpanProcessor.builder(otlpExporter).build())
    .build();

OpenTelemetrySdk openTelemetry = OpenTelemetrySdk.builder()
    .setTracerProvider(tracerProvider)
    .buildAndRegisterGlobal();

// Shim 생성
Tracer tracer = OpenTracingShim.createTracerShim(openTelemetry);

// 기존 OpenTracing API 사용 가능
Span span = tracer.buildSpan("operation").start();
span.finish();
```

#### Step 3: 점진적 네이티브 전환

```javascript
// Phase 1: Shim 사용 (기존 코드)
const span = opentracing.globalTracer().startSpan('operation');
span.setTag('key', 'value');
span.finish();

// Phase 2: 새 코드는 네이티브 OTel 사용
const { trace } = require('@opentelemetry/api');
const tracer = trace.getTracer('my-service');
const span = tracer.startSpan('operation');
span.setAttribute('key', 'value');
span.end();

// 두 방식이 동일한 트레이스에 참여 가능!
```

---

## 🔌 벤더 SDK에서 마이그레이션

### DataDog에서 전환

```yaml
# OTel Collector 설정 - DataDog으로 동시 전송
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

exporters:
  # 기존 DataDog 유지 (병행 운영)
  datadog:
    api:
      key: ${DD_API_KEY}
      site: datadoghq.com

  # 새로운 백엔드 추가
  otlp:
    endpoint: "tempo:4317"
    tls:
      insecure: true

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [datadog, otlp]  # 두 곳에 동시 전송
```

### 애플리케이션 코드 전환

```python
# Before: DataDog SDK
from ddtrace import tracer

@tracer.wrap()
def process_order(order_id):
    span = tracer.current_span()
    span.set_tag('order.id', order_id)
    # 로직

# After: OpenTelemetry SDK
from opentelemetry import trace
from opentelemetry.instrumentation.decorators import instrument

tracer = trace.get_tracer(__name__)

@instrument(tracer, "process_order")
def process_order(order_id):
    span = trace.get_current_span()
    span.set_attribute('order.id', order_id)
    # 로직
```

---

## 🔄 Jaeger Client에서 마이그레이션

### 직접 전환 방식

Jaeger Client는 공식적으로 deprecated되었으므로 직접 전환을 권장합니다.

```go
// Before: Jaeger Client
import (
    "github.com/uber/jaeger-client-go"
    "github.com/uber/jaeger-client-go/config"
)

func initJaeger(service string) (opentracing.Tracer, io.Closer, error) {
    cfg := config.Configuration{
        ServiceName: service,
        Sampler: &config.SamplerConfig{
            Type:  jaeger.SamplerTypeConst,
            Param: 1,
        },
    }
    return cfg.NewTracer()
}

// After: OpenTelemetry
import (
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
    "go.opentelemetry.io/otel/sdk/resource"
    "go.opentelemetry.io/otel/sdk/trace"
    semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
)

func initOTel(ctx context.Context, service string) (*trace.TracerProvider, error) {
    exporter, err := otlptracegrpc.New(ctx,
        otlptracegrpc.WithEndpoint("otel-collector:4317"),
        otlptracegrpc.WithInsecure(),
    )
    if err != nil {
        return nil, err
    }

    tp := trace.NewTracerProvider(
        trace.WithBatcher(exporter),
        trace.WithResource(resource.NewWithAttributes(
            semconv.SchemaURL,
            semconv.ServiceNameKey.String(service),
        )),
    )
    otel.SetTracerProvider(tp)
    return tp, nil
}
```

### Collector 기반 전환 (무중단)

```yaml
# OTel Collector - Jaeger 형식 수신
receivers:
  jaeger:
    protocols:
      thrift_http:
        endpoint: 0.0.0.0:14268
      thrift_compact:
        endpoint: 0.0.0.0:6831
      grpc:
        endpoint: 0.0.0.0:14250

exporters:
  otlp:
    endpoint: "tempo:4317"

service:
  pipelines:
    traces:
      receivers: [jaeger]  # 기존 Jaeger 형식 수신
      exporters: [otlp]    # OTLP로 변환하여 전송
```

---

## 🌐 Zipkin에서 마이그레이션

### Collector 기반 전환

```yaml
# OTel Collector 설정
receivers:
  zipkin:
    endpoint: 0.0.0.0:9411

processors:
  batch:
    timeout: 1s
    send_batch_size: 1024

exporters:
  otlp:
    endpoint: "otel-backend:4317"

service:
  pipelines:
    traces:
      receivers: [zipkin]
      processors: [batch]
      exporters: [otlp]
```

### 코드 레벨 전환

```java
// Before: Brave (Zipkin)
import brave.Tracing;
import brave.Span;

Tracing tracing = Tracing.newBuilder()
    .localServiceName("my-service")
    .spanReporter(reporter)
    .build();

Span span = tracing.tracer().newTrace().name("operation").start();
span.tag("key", "value");
span.finish();

// After: OpenTelemetry
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.api.trace.Span;

Tracer tracer = GlobalOpenTelemetry.getTracer("my-service");

Span span = tracer.spanBuilder("operation").startSpan();
span.setAttribute("key", "value");
span.end();
```

---

## 🏢 Zalando 방식: 레거시 수신기 활용

Zalando가 오픈소스로 공개한 Lightstep Receiver 접근법입니다.

```yaml
# 레거시 트레이서에서 전송된 데이터를 OTel로 변환
receivers:
  lightstep:
    endpoint: 0.0.0.0:8181
    access_token: ${LIGHTSTEP_TOKEN}

processors:
  # 레거시 형식을 OTel 컨벤션으로 변환
  transform:
    trace_statements:
      - context: span
        statements:
          - set(attributes["service.name"], resource.attributes["service.name"])

exporters:
  otlp:
    endpoint: "otel-backend:4317"

service:
  pipelines:
    traces:
      receivers: [lightstep]
      processors: [transform]
      exporters: [otlp]
```

**핵심 이점:**
- 애플리케이션 코드 변경 없음
- 인프라 레벨에서 투명하게 전환
- 점진적 애플리케이션 마이그레이션 가능

---

## 📋 마이그레이션 체크리스트

### Pre-Migration

```
□ 현재 트레이싱 구성 문서화
  - 사용 중인 라이브러리 및 버전
  - 샘플링 설정
  - 커스텀 계측 위치
  - 통합된 백엔드

□ 영향 범위 분석
  - 영향받는 서비스 목록
  - 의존성 맵핑
  - 팀별 담당자 식별

□ 롤백 계획 수립
  - 롤백 트리거 조건 정의
  - 롤백 절차 문서화
  - 롤백 테스트 완료
```

### Migration Phase

```
□ Phase 1: 인프라 준비
  - OTel Collector 배포
  - 네트워크 정책 설정
  - 모니터링 설정

□ Phase 2: 병행 운영
  - 기존 + OTel 동시 전송 설정
  - 데이터 정합성 검증
  - 성능 영향 측정

□ Phase 3: 전환
  - 서비스별 순차 전환
  - 각 전환 후 검증
  - 이슈 발생 시 롤백

□ Phase 4: 정리
  - 레거시 에이전트 제거
  - 불필요한 설정 정리
  - 문서 업데이트
```

### Post-Migration

```
□ 검증
  - 트레이스 연속성 확인
  - 메트릭 정확성 검증
  - 알람 동작 확인

□ 최적화
  - 샘플링 튜닝
  - 리소스 최적화
  - 비용 분석

□ 지식 이전
  - 팀 교육 완료
  - 운영 가이드 배포
  - 온콜 프로세스 업데이트
```

---

## ⚠️ 마이그레이션 시 주의사항

### 1. Context Propagation 호환성

```
┌─────────────────────────────────────────────────────────────┐
│              Context Propagation 호환성                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  헤더 형식        지원 여부      권장 사항                  │
│  ─────────        ─────────      ─────────                  │
│  W3C TraceContext  ✅ Native    새 서비스에 사용           │
│  B3 (Zipkin)       ✅ 지원      마이그레이션 중 병행       │
│  Jaeger            ✅ 지원      마이그레이션 중 병행       │
│  X-Ray             ✅ 지원      AWS 환경에서 병행          │
│                                                             │
│  💡 팁: 전환 기간에는 여러 형식을 동시에 주입/추출        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

```javascript
// 복수 Propagator 설정
const { CompositePropagator, W3CTraceContextPropagator } = require('@opentelemetry/core');
const { B3Propagator, B3InjectEncoding } = require('@opentelemetry/propagator-b3');
const { JaegerPropagator } = require('@opentelemetry/propagator-jaeger');

// 마이그레이션 기간 중 모든 형식 지원
const propagator = new CompositePropagator({
  propagators: [
    new W3CTraceContextPropagator(),
    new B3Propagator({ injectEncoding: B3InjectEncoding.MULTI_HEADER }),
    new JaegerPropagator(),
  ],
});
```

### 2. 샘플링 전략 차이

```yaml
# 기존 Jaeger Sampler와 OTel Sampler 차이점
# OTel은 더 유연한 샘플링 옵션 제공

# Jaeger 스타일 (const, probabilistic, ratelimiting)
sampling:
  type: probabilistic
  param: 0.1

# OTel 스타일 (ParentBased, TraceIdRatio, AlwaysOn, AlwaysOff)
processors:
  probabilistic_sampler:
    sampling_percentage: 10
```

### 3. Semantic Conventions 차이

```
기존 태그명              OpenTelemetry Convention
────────────────        ──────────────────────────
http.url         →      url.full
http.method      →      http.request.method
http.status_code →      http.response.status_code
peer.service     →      peer.service (동일)
db.type          →      db.system
db.statement     →      db.query.text
```

---

## 🔗 참고 자료

- [OpenTelemetry 공식 마이그레이션 가이드](https://opentelemetry.io/docs/migration/)
- [OpenTracing Shim 문서](https://opentelemetry.io/docs/specs/otel/compatibility/opentracing/)
- [Skyscanner 마이그레이션 사례](https://medium.com/@SkyscannerEng/skyscanners-journey-to-effective-observability-655167a49d2f)
- [Zalando Lightstep Receiver](https://engineering.zalando.com/posts/2025/01/otelcollector-lightstep-receiver-oss.html)
