---
sidebar_position: 4
title: 시그널 (Signals)
description: OpenTelemetry의 세 가지 시그널 - Traces, Metrics, Logs를 상세히 알아봅니다
---

# OpenTelemetry 시그널

OpenTelemetry는 세 가지 핵심 시그널을 제공합니다: **Traces**, **Metrics**, **Logs**

![Three Signals](/img/content/three-signals.svg)

## 1. Traces (분산 추적)

### 용도
- 요청의 전체 여정 추적
- 서비스 간 호출 관계 파악
- 지연 시간 분석 및 병목 식별

### 구성 요소

```mermaid
flowchart TB
    T["🔍 Trace"] --> RS["Root Span"]
    RS --> C1["Child Span"]
    RS --> C2["Child Span"]
    C1 --> GC["Grandchild Span"]
    C2 --> E["📌 Event"]

    style T fill:#6366f1,color:#fff
    style RS fill:#8b5cf6,color:#fff
    style C1 fill:#a855f7,color:#fff
    style C2 fill:#a855f7,color:#fff
    style GC fill:#c084fc,color:#fff
    style E fill:#f59e0b,color:#fff
```

### 코드 예시

```python
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

# 기본 Span 생성
with tracer.start_as_current_span("process-order") as span:
    # 속성 추가
    span.set_attribute("order.id", "12345")
    span.set_attribute("customer.id", "cust-001")

    # 중첩 Span
    with tracer.start_as_current_span("validate-order"):
        validate_order()

    with tracer.start_as_current_span("process-payment"):
        # 이벤트 기록
        span.add_event("payment_started", {
            "payment.method": "credit_card"
        })
        process_payment()
        span.add_event("payment_completed")

    # 상태 설정
    span.set_status(trace.Status(trace.StatusCode.OK))
```

### Span 상태 코드

| 상태 | 설명 |
|------|------|
| `UNSET` | 기본값, 상태 미설정 |
| `OK` | 작업 성공 |
| `ERROR` | 작업 실패 |

## 2. Metrics (메트릭)

### 용도
- 시스템/비즈니스 지표 측정
- 시계열 데이터 수집
- 알림 및 대시보드 구성

### Instrument 타입

```mermaid
flowchart TB
    subgraph Sync["📊 Synchronous (동기)"]
        direction TB
        C["Counter<br/>단조 증가 카운터<br/>예: 요청 수, 에러 수"]
        UC["UpDownCounter<br/>증감 가능 카운터<br/>예: 활성 연결 수"]
        H["Histogram<br/>값의 분포 측정<br/>예: 지연 시간 분포"]
    end

    subgraph Async["🔄 Asynchronous (비동기/Observable)"]
        direction TB
        OC["ObservableCounter<br/>외부 상태 관찰<br/>예: 프로세스 시작"]
        OUC["ObservableUpDownCounter<br/>증감 외부 상태<br/>예: 큐 크기"]
        OG["ObservableGauge<br/>현재 값 관찰<br/>예: CPU 사용률"]
    end

    style C fill:#3b82f6,color:#fff
    style UC fill:#3b82f6,color:#fff
    style H fill:#3b82f6,color:#fff
    style OC fill:#8b5cf6,color:#fff
    style OUC fill:#8b5cf6,color:#fff
    style OG fill:#8b5cf6,color:#fff
```

### 코드 예시

```python
from opentelemetry import metrics

meter = metrics.get_meter(__name__)

# Counter - 단조 증가
request_counter = meter.create_counter(
    name="http_requests_total",
    description="Total HTTP requests",
    unit="1"
)

# 사용
request_counter.add(1, {"method": "GET", "path": "/api/users"})

# Histogram - 분포 측정
latency_histogram = meter.create_histogram(
    name="http_request_duration_seconds",
    description="HTTP request latency",
    unit="s"
)

# 사용
latency_histogram.record(0.125, {"method": "GET", "status": "200"})

# UpDownCounter - 증감 가능
active_connections = meter.create_up_down_counter(
    name="active_connections",
    description="Number of active connections"
)

# 사용
active_connections.add(1)   # 연결 추가
active_connections.add(-1)  # 연결 종료

# Observable Gauge - 비동기 관찰
def get_cpu_usage(options):
    yield metrics.Observation(
        value=get_current_cpu(),
        attributes={"cpu": "0"}
    )

meter.create_observable_gauge(
    name="system_cpu_usage",
    callbacks=[get_cpu_usage],
    description="Current CPU usage"
)
```

### 일반적인 메트릭 패턴

#### RED 메트릭 (Request-focused)

```mermaid
flowchart LR
    subgraph RED["🎯 RED Metrics - 서비스 관점"]
        R["📈 R - Rate<br/>요청률<br/>requests/sec"]
        E["❌ E - Errors<br/>에러율<br/>error %"]
        D["⏱️ D - Duration<br/>지연 시간<br/>p50, p95, p99"]
    end

    RED --> SLI["SLI/SLO 정의에 활용"]

    style R fill:#22c55e,color:#fff
    style E fill:#ef4444,color:#fff
    style D fill:#3b82f6,color:#fff
    style SLI fill:#f59e0b,color:#fff
```

#### USE 메트릭 (Resource-focused)

```mermaid
flowchart LR
    subgraph USE["⚙️ USE Metrics - 리소스 관점"]
        U["📊 U - Utilization<br/>사용률<br/>CPU%, Memory%"]
        S["🔥 S - Saturation<br/>포화도<br/>큐 길이, 대기 스레드"]
        E2["❌ E - Errors<br/>에러<br/>디스크/네트워크 에러"]
    end

    USE --> CAP["용량 계획에 활용"]

    style U fill:#8b5cf6,color:#fff
    style S fill:#ec4899,color:#fff
    style E2 fill:#ef4444,color:#fff
    style CAP fill:#f59e0b,color:#fff
```

## 3. Logs (로그)

### 용도
- 상세한 이벤트 기록
- 디버깅 및 감사
- Trace와 연결된 컨텍스트 로깅

### OTel Logs 데이터 모델

```mermaid
flowchart TB
    subgraph LogRecord["📝 Log Record Structure"]
        direction TB
        TS["⏰ timestamp<br/>2024-01-15T10:30:00.000Z"]
        OTS["👁️ observed_timestamp<br/>2024-01-15T10:30:00.001Z"]

        subgraph Correlation["🔗 Trace 연결"]
            TID["trace_id: abc123..."]
            SID["span_id: def456..."]
        end

        subgraph Severity["⚠️ 심각도"]
            SN["severity_number: 9"]
            ST["severity_text: INFO"]
        end

        BODY["💬 body: Order processed"]

        subgraph Attrs["📋 attributes"]
            A1["order.id: 12345"]
            A2["customer.id: cust-001"]
        end

        subgraph Res["🏷️ resource"]
            R1["service.name: order-service"]
            R2["service.version: 1.0.0"]
        end
    end

    style TS fill:#3b82f6,color:#fff
    style OTS fill:#3b82f6,color:#fff
    style TID fill:#8b5cf6,color:#fff
    style SID fill:#8b5cf6,color:#fff
    style SN fill:#f59e0b,color:#fff
    style ST fill:#f59e0b,color:#fff
    style BODY fill:#22c55e,color:#fff
    style A1 fill:#ec4899,color:#fff
    style A2 fill:#ec4899,color:#fff
    style R1 fill:#14b8a6,color:#fff
    style R2 fill:#14b8a6,color:#fff
```

### 심각도 레벨

| 숫자 | 텍스트 | 설명 |
|------|--------|------|
| 1-4 | TRACE | 매우 상세한 디버그 정보 |
| 5-8 | DEBUG | 디버그 정보 |
| 9-12 | INFO | 정보성 메시지 |
| 13-16 | WARN | 경고 |
| 17-20 | ERROR | 에러 |
| 21-24 | FATAL | 치명적 에러 |

### 코드 예시

```python
import logging
from opentelemetry import trace
from opentelemetry._logs import set_logger_provider
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter

# OTel Logs 설정
logger_provider = LoggerProvider()
logger_provider.add_log_record_processor(
    BatchLogRecordProcessor(OTLPLogExporter())
)
set_logger_provider(logger_provider)

# Python logging과 연동
handler = LoggingHandler(logger_provider=logger_provider)
logging.getLogger().addHandler(handler)

# 사용
logger = logging.getLogger(__name__)

# Trace 컨텍스트 내에서 로깅
tracer = trace.get_tracer(__name__)
with tracer.start_as_current_span("process-order"):
    logger.info("Processing order", extra={
        "order.id": "12345",
        "customer.id": "cust-001"
    })
    # 로그에 자동으로 trace_id, span_id 포함됨
```

## 시그널 간 상관관계 (Correlation)

### Trace ID를 통한 연결

```mermaid
flowchart TB
    subgraph Trace["🔍 Trace (trace_id: abc123)"]
        direction TB
        S1["📍 Span: HTTP GET /api/orders"]
        S2["📍 Span: DB Query"]

        S1 --> L1["📝 Log: Fetching orders"]
        S1 --> M1["📊 Metric: http_request_duration"]
        S1 --> L2["📝 Log: Found 5 orders"]

        S1 --> S2
        S2 --> L3["📝 Log: Query executed"]
    end

    Note["💡 동일한 trace_id로<br/>모든 시그널 연결 가능"]

    style S1 fill:#6366f1,color:#fff
    style S2 fill:#6366f1,color:#fff
    style L1 fill:#22c55e,color:#fff
    style L2 fill:#22c55e,color:#fff
    style L3 fill:#22c55e,color:#fff
    style M1 fill:#f59e0b,color:#fff
    style Note fill:#ec4899,color:#fff
```

### Exemplars (메트릭-트레이스 연결)

```yaml
# Histogram 메트릭에 Trace 샘플 첨부
http_request_duration_bucket{le="0.5"} 100
http_request_duration_bucket{le="1.0"} 150

# Exemplar
http_request_duration_bucket{le="1.0"} 150 # {trace_id="abc123"} 0.85

# 느린 요청의 구체적인 Trace 확인 가능
```

## 시그널 선택 가이드

```mermaid
flowchart TB
    subgraph Questions["❓ 어떤 질문을 하고 있는가?"]
        direction TB
        subgraph TracesQ["🔍 Traces 사용"]
            Q1["이 요청이 왜 느린가?"]
            Q2["어떤 서비스를 거쳤는가?"]
            Q3["에러가 어디서 발생했는가?"]
        end

        subgraph MetricsQ["📊 Metrics 사용"]
            Q4["분당 요청 수는?"]
            Q5["평균 응답 시간은?"]
            Q6["에러율이 얼마인가?"]
            Q7["CPU 사용률은?"]
        end

        subgraph LogsQ["📝 Logs 사용"]
            Q8["정확히 무슨 일이 있었는가?"]
            Q9["사용자가 무엇을 했는가?"]
            Q10["에러의 상세 내용은?"]
        end
    end

    style Q1 fill:#6366f1,color:#fff
    style Q2 fill:#6366f1,color:#fff
    style Q3 fill:#6366f1,color:#fff
    style Q4 fill:#22c55e,color:#fff
    style Q5 fill:#22c55e,color:#fff
    style Q6 fill:#22c55e,color:#fff
    style Q7 fill:#22c55e,color:#fff
    style Q8 fill:#f59e0b,color:#fff
    style Q9 fill:#f59e0b,color:#fff
    style Q10 fill:#f59e0b,color:#fff
```

## 다음 단계

시그널을 이해했다면:
- [시작하기](./getting-started) - 실제 코드로 시그널 생성
- [계측](../intermediate/instrumentation) - 다양한 계측 방법 학습
