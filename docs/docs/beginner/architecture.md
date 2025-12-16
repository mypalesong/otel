---
sidebar_position: 3
title: 아키텍처
description: OpenTelemetry의 구성 요소와 데이터 흐름을 이해합니다
---

# OpenTelemetry 아키텍처

## 전체 아키텍처 개요

OpenTelemetry는 크게 세 가지 계층으로 구성됩니다:

```mermaid
flowchart TB
    subgraph App["📱 Application Layer"]
        API["OTel API"]
        SDK["OTel SDK"]
        Auto["Auto<br/>Instrumentation"]
    end

    subgraph Collection["⚙️ Collection Layer"]
        subgraph Collector["OTel Collector"]
            Receivers["📥 Receivers"]
            Processors["🔄 Processors"]
            Exporters["📤 Exporters"]
            Receivers --> Processors --> Exporters
        end
    end

    subgraph Backend["🗄️ Backend Layer"]
        Jaeger["Jaeger<br/>Traces"]
        Tempo["Tempo<br/>Traces"]
        Prometheus["Prometheus<br/>Metrics"]
        Loki["Loki<br/>Logs"]
    end

    API --> SDK
    Auto --> SDK
    SDK --> Receivers
    Exporters --> Jaeger
    Exporters --> Tempo
    Exporters --> Prometheus
    Exporters --> Loki

    style API fill:#6366f1,color:#fff
    style SDK fill:#8b5cf6,color:#fff
    style Auto fill:#a855f7,color:#fff
    style Jaeger fill:#22c55e,color:#fff
    style Tempo fill:#f59e0b,color:#fff
    style Prometheus fill:#ef4444,color:#fff
    style Loki fill:#3b82f6,color:#fff
```

## 구성 요소 상세

### 1. OTel API

**목적**: 계측(Instrumentation)을 위한 인터페이스 정의

```mermaid
flowchart TB
    subgraph Tracing["🔍 Tracing"]
        TP["TracerProvider"] --> T["Tracer"]
        T --> SB["SpanBuilder"]
        SB --> S["Span"]
    end

    subgraph Metrics["📊 Metrics"]
        MP["MeterProvider"] --> M["Meter"]
        M --> C["Counter"]
        M --> G["Gauge"]
        M --> H["Histogram"]
    end

    subgraph Logging["📝 Logging"]
        LP["LoggerProvider"] --> L["Logger"]
        L --> LR["Log Records"]
    end

    style TP fill:#6366f1,color:#fff
    style MP fill:#22c55e,color:#fff
    style LP fill:#f59e0b,color:#fff
```

**특징**:
- 최소한의 의존성
- No-op 구현 제공 (SDK 없이도 동작)
- 언어별로 관용적인 API 설계

### 2. OTel SDK

**목적**: API의 실제 구현 제공

```python
# SDK 설정 예시 (Python)
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

# Provider 설정
provider = TracerProvider()

# Processor와 Exporter 설정
processor = BatchSpanProcessor(
    OTLPSpanExporter(endpoint="http://collector:4317")
)
provider.add_span_processor(processor)

# 전역 Provider로 설정
trace.set_tracer_provider(provider)
```

**SDK 구성 요소**:

| 구성 요소 | 역할 |
|-----------|------|
| **TracerProvider** | Tracer 인스턴스 생성 및 관리 |
| **SpanProcessor** | Span 처리 파이프라인 |
| **SpanExporter** | Span 데이터 내보내기 |
| **Sampler** | 샘플링 전략 적용 |
| **Resource** | 리소스 정보 관리 |

### 3. Auto-Instrumentation (자동 계측)

**목적**: 코드 변경 없이 자동으로 텔레메트리 수집

```mermaid
flowchart TB
    subgraph Auto["🤖 Auto-Instrumentation 방식"]
        direction TB
        subgraph Agent["방식 1: Agent (Java, Python, Node.js)"]
            A1["java -javaagent:opentelemetry-javaagent.jar"]
            A2["JVM 바이트코드 조작으로 자동 계측"]
        end

        subgraph Lib["방식 2: Instrumentation Libraries"]
            L1["pip install opentelemetry-instrumentation-flask"]
            L2["FlaskInstrumentor().instrument()"]
        end
    end

    Agent --> App["📱 Application"]
    Lib --> App

    style A1 fill:#6366f1,color:#fff
    style A2 fill:#6366f1,color:#fff
    style L1 fill:#22c55e,color:#fff
    style L2 fill:#22c55e,color:#fff
    style App fill:#f59e0b,color:#fff
```

**지원하는 라이브러리/프레임워크 예시**:

| 언어 | HTTP | 데이터베이스 | 메시징 |
|------|------|-------------|--------|
| Java | Spring, JAX-RS | JDBC, Hibernate | Kafka, RabbitMQ |
| Python | Flask, Django, FastAPI | SQLAlchemy, psycopg2 | kafka-python |
| Node.js | Express, Fastify | pg, mysql2 | kafkajs |
| Go | net/http, gin | database/sql | sarama |

## OTel Collector 아키텍처

Collector는 OpenTelemetry의 핵심 컴포넌트입니다:

```mermaid
flowchart TB
    subgraph Collector["⚙️ OTel Collector"]
        direction TB
        subgraph Receivers["📥 Receivers"]
            R1["OTLP<br/>gRPC/HTTP"]
            R2["Jaeger"]
            R3["Zipkin"]
            R4["Prometheus"]
        end

        subgraph Processors["🔄 Processors"]
            P1["Batch"]
            P2["Memory<br/>Limiter"]
            P3["Attribute"]
            P4["Filter"]
        end

        subgraph Exporters["📤 Exporters"]
            E1["OTLP"]
            E2["Jaeger"]
            E3["Prometheus"]
            E4["Loki"]
        end

        Receivers --> Processors
        Processors --> Exporters
    end

    style R1 fill:#3b82f6,color:#fff
    style R2 fill:#3b82f6,color:#fff
    style R3 fill:#3b82f6,color:#fff
    style R4 fill:#3b82f6,color:#fff
    style P1 fill:#8b5cf6,color:#fff
    style P2 fill:#8b5cf6,color:#fff
    style P3 fill:#8b5cf6,color:#fff
    style P4 fill:#8b5cf6,color:#fff
    style E1 fill:#22c55e,color:#fff
    style E2 fill:#22c55e,color:#fff
    style E3 fill:#22c55e,color:#fff
    style E4 fill:#22c55e,color:#fff
```

### Receiver (수신기)

외부 소스에서 텔레메트리 데이터 수신:

```yaml
# collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

  jaeger:
    protocols:
      thrift_http:
        endpoint: 0.0.0.0:14268

  prometheus:
    config:
      scrape_configs:
        - job_name: 'my-app'
          static_configs:
            - targets: ['localhost:8080']
```

### Processor (처리기)

데이터 변환, 필터링, 배치 처리:

```yaml
processors:
  # 배치 처리 (성능 최적화)
  batch:
    timeout: 5s
    send_batch_size: 1000

  # 메모리 제한 (안정성)
  memory_limiter:
    check_interval: 1s
    limit_mib: 1000

  # 속성 수정
  attributes:
    actions:
      - key: environment
        value: production
        action: insert

  # 불필요한 데이터 필터링
  filter:
    traces:
      span:
        - 'attributes["http.target"] == "/health"'
```

### Exporter (내보내기)

처리된 데이터를 백엔드로 전송:

```yaml
exporters:
  # OTLP 프로토콜로 전송
  otlp:
    endpoint: tempo:4317
    tls:
      insecure: true

  # Jaeger로 전송
  jaeger:
    endpoint: jaeger:14250
    tls:
      insecure: true

  # Prometheus 메트릭 노출
  prometheus:
    endpoint: 0.0.0.0:8889

  # 디버그용 콘솔 출력
  logging:
    verbosity: detailed
```

## 배포 패턴

### 패턴 1: Agent 모드

각 서버/Pod에 Collector를 사이드카로 배포:

```mermaid
flowchart TB
    subgraph Pod["📦 Node/Pod"]
        App["📱 Application"] -->|OTLP| Agent["⚙️ OTel Collector<br/>Agent Mode<br/>localhost:4317"]
    end

    Agent --> Central["🏢 Central Collector/Backend"]

    style App fill:#3b82f6,color:#fff
    style Agent fill:#8b5cf6,color:#fff
    style Central fill:#22c55e,color:#fff
```

**장점**: 낮은 네트워크 지연, 애플리케이션과 독립적 설정
**단점**: 리소스 오버헤드

### 패턴 2: Gateway 모드

중앙 집중식 Collector 배포:

```mermaid
flowchart TB
    A1["📱 App 1"] --> GW
    A2["📱 App 2"] --> GW
    A3["📱 App 3"] --> GW

    GW["⚙️ OTel Collector<br/>Gateway Mode"]

    GW --> J["Jaeger"]
    GW --> T["Tempo"]
    GW --> P["Prometheus"]

    style A1 fill:#3b82f6,color:#fff
    style A2 fill:#3b82f6,color:#fff
    style A3 fill:#3b82f6,color:#fff
    style GW fill:#ec4899,color:#fff
    style J fill:#22c55e,color:#fff
    style T fill:#f59e0b,color:#fff
    style P fill:#ef4444,color:#fff
```

**장점**: 중앙 집중식 관리, 리소스 효율성
**단점**: 단일 장애점, 네트워크 지연

### 패턴 3: 하이브리드 모드 (권장)

Agent + Gateway 조합:

```mermaid
flowchart TB
    subgraph K8s["☸️ Kubernetes Cluster"]
        subgraph Pod1["📦 Pod 1"]
            App1["📱 App"] --> Agent1["⚙️ Agent"]
        end
        subgraph Pod2["📦 Pod 2"]
            App2["📱 App"] --> Agent2["⚙️ Agent"]
        end

        Agent1 --> GW["🌐 OTel Collector Gateway<br/>Deployment/StatefulSet"]
        Agent2 --> GW
    end

    GW --> Backend["🗄️ Backend Systems<br/>Jaeger, Tempo"]

    style App1 fill:#3b82f6,color:#fff
    style App2 fill:#3b82f6,color:#fff
    style Agent1 fill:#8b5cf6,color:#fff
    style Agent2 fill:#8b5cf6,color:#fff
    style GW fill:#ec4899,color:#fff
    style Backend fill:#22c55e,color:#fff
```

## 데이터 흐름 요약

```mermaid
flowchart LR
    subgraph Step1["1️⃣ 계측"]
        App["Application"] --> API["API"] --> SDK["SDK"] --> Span["Span 생성"]
    end

    subgraph Step2["2️⃣ 처리"]
        Span --> Proc["SpanProcessor"] --> Samp["Sampling"] --> Batch["Batching"]
    end

    subgraph Step3["3️⃣ 내보내기"]
        Batch --> Exp["Exporter"] --> OTLP["OTLP Protocol"]
    end

    subgraph Step4["4️⃣ 수집"]
        OTLP --> Recv["Collector<br/>Receiver"]
    end

    subgraph Step5["5️⃣ 가공"]
        Recv --> Procs["Processors<br/>Filter, Enrich"]
    end

    subgraph Step6["6️⃣ 저장"]
        Procs --> ExpC["Exporters"] --> Back["Backend<br/>Jaeger, Tempo"]
    end

    subgraph Step7["7️⃣ 시각화"]
        Back --> UI["UI"] --> User["👤 사용자"]
    end

    style App fill:#3b82f6,color:#fff
    style Span fill:#6366f1,color:#fff
    style Batch fill:#8b5cf6,color:#fff
    style OTLP fill:#a855f7,color:#fff
    style Recv fill:#ec4899,color:#fff
    style Procs fill:#f43f5e,color:#fff
    style Back fill:#22c55e,color:#fff
    style User fill:#f59e0b,color:#fff
```

## 다음 단계

- [시그널](./signals) - Traces, Metrics, Logs 상세 학습
- [시작하기](./getting-started) - 첫 번째 OTel 애플리케이션
