---
sidebar_position: 1
title: OTel Collector 이해하기
description: OpenTelemetry Collector의 역할과 중요성을 알아봅니다
---

# OTel Collector 이해하기

## Collector란?

OpenTelemetry Collector는 벤더에 구애받지 않는(vendor-agnostic) 텔레메트리 데이터 수집, 처리, 내보내기 파이프라인입니다.

```mermaid
flowchart TB
    SA["📱 Service A<br/>OTLP"] --> Coll
    SB["📱 Service B<br/>Jaeger"] --> Coll
    SC["📱 Service C<br/>Zipkin"] --> Coll
    SD["📱 Service D<br/>Prometheus"] --> Coll

    Coll["⚙️ OTel Collector<br/>수집 → 처리 → 내보내기"]

    Coll --> J["🔍 Jaeger"]
    Coll --> T["📊 Tempo"]
    Coll --> P["📈 Prometheus"]

    style SA fill:#3b82f6,color:#fff
    style SB fill:#3b82f6,color:#fff
    style SC fill:#3b82f6,color:#fff
    style SD fill:#3b82f6,color:#fff
    style Coll fill:#ec4899,color:#fff
    style J fill:#22c55e,color:#fff
    style T fill:#f59e0b,color:#fff
    style P fill:#ef4444,color:#fff
```

## Collector를 사용해야 하는 이유

### 1. 애플리케이션 분리

```mermaid
flowchart TB
    subgraph Without["❌ Without Collector"]
        direction TB
        App1["📱 Application"]
        BL1["Business Logic"]
        EX1["Jaeger Exporter<br/>Prometheus Exporter<br/>Retry Logic<br/>Batching Logic"]
        App1 --- BL1 --- EX1
    end

    subgraph With["✅ With Collector"]
        direction TB
        App2["📱 Application"]
        BL2["Business Logic"]
        OTLP["OTLP Exporter<br/>(단순)"]
        App2 --- BL2 --- OTLP
        OTLP --> Coll["⚙️ OTel Collector<br/>• 다중 백엔드 지원<br/>• 재시도 로직<br/>• 배치 처리<br/>• 데이터 변환"]
    end

    style App1 fill:#ef4444,color:#fff
    style EX1 fill:#ef4444,color:#fff
    style App2 fill:#22c55e,color:#fff
    style OTLP fill:#22c55e,color:#fff
    style Coll fill:#ec4899,color:#fff
```

### 2. 백엔드 유연성

Collector가 있으면 애플리케이션 코드 변경 없이 백엔드 교체 가능:

```yaml
# Before: Jaeger만 사용
exporters:
  jaeger:
    endpoint: jaeger:14250

# After: Tempo 추가 (앱 코드 변경 없음)
exporters:
  jaeger:
    endpoint: jaeger:14250
  otlp:
    endpoint: tempo:4317
```

### 3. 데이터 처리

```mermaid
flowchart TB
    subgraph Processing["⚙️ Collector 데이터 처리 기능"]
        direction TB
        subgraph Recv["📥 수집 (Receivers)"]
            R1["다양한 포맷 수신<br/>OTLP, Jaeger, Zipkin, Prometheus"]
            R2["프로토콜 변환"]
        end

        subgraph Proc["⚙️ 처리 (Processors)"]
            P1["Batching - 성능 최적화"]
            P2["Memory Limiting - 안정성"]
            P3["Sampling - 비용 절감"]
            P4["Filtering - 불필요 데이터 제거"]
            P5["Attributes - 데이터 보강"]
            P6["Resource Detection - 자동 메타데이터"]
        end

        subgraph Exp["📤 내보내기 (Exporters)"]
            E1["다중 백엔드 동시 전송"]
            E2["재시도 및 큐잉"]
            E3["압축 및 인증"]
        end

        Recv --> Proc --> Exp
    end

    style R1 fill:#3b82f6,color:#fff
    style R2 fill:#3b82f6,color:#fff
    style P1 fill:#8b5cf6,color:#fff
    style P2 fill:#8b5cf6,color:#fff
    style P3 fill:#8b5cf6,color:#fff
    style P4 fill:#8b5cf6,color:#fff
    style P5 fill:#8b5cf6,color:#fff
    style P6 fill:#8b5cf6,color:#fff
    style E1 fill:#22c55e,color:#fff
    style E2 fill:#22c55e,color:#fff
    style E3 fill:#22c55e,color:#fff
```

## Collector 배포 방식

### 1. Agent 모드 (Sidecar/DaemonSet)

```mermaid
flowchart TB
    subgraph K8sNode["☸️ Kubernetes Node"]
        subgraph Pod1["📦 Pod 1"]
            App1["📱 App"] --> Coll1["⚙️ Collector<br/>Agent"]
        end
        subgraph Pod2["📦 Pod 2"]
            App2["📱 App"] --> Coll2["⚙️ Collector<br/>Agent"]
        end

        Coll1 --> Central["🏢 Central Collector/Backend"]
        Coll2 --> Central
    end

    style App1 fill:#3b82f6,color:#fff
    style App2 fill:#3b82f6,color:#fff
    style Coll1 fill:#8b5cf6,color:#fff
    style Coll2 fill:#8b5cf6,color:#fff
    style Central fill:#22c55e,color:#fff
```

**특징**:
- 각 앱과 함께 Collector 배포
- localhost 통신으로 낮은 지연
- 앱별 설정 가능

**사용 케이스**:
- 높은 처리량이 필요한 경우
- 네트워크 지연에 민감한 경우
- 앱별 다른 처리가 필요한 경우

### 2. Gateway 모드

```mermaid
flowchart TB
    subgraph K8sCluster["☸️ Kubernetes Cluster"]
        A1["📱 App 1"] --> GW
        A2["📱 App 2"] --> GW
        A3["📱 App 3"] --> GW
        A4["📱 App 4"] --> GW

        GW["🌐 OTel Collector Gateway<br/>Deployment, 3 replicas"]
    end

    GW --> Ext["🗄️ External Backends"]

    style A1 fill:#3b82f6,color:#fff
    style A2 fill:#3b82f6,color:#fff
    style A3 fill:#3b82f6,color:#fff
    style A4 fill:#3b82f6,color:#fff
    style GW fill:#ec4899,color:#fff
    style Ext fill:#22c55e,color:#fff
```

**특징**:
- 중앙 집중식 관리
- 수평 확장 가능
- 리소스 효율적

**사용 케이스**:
- 중앙 집중식 처리가 필요한 경우
- 복잡한 라우팅 규칙이 필요한 경우
- 외부 백엔드로 내보내기 전 집계

### 3. 하이브리드 모드 (권장)

```mermaid
flowchart TB
    subgraph Prod["🏭 Production Architecture"]
        subgraph Pod["📦 Pod"]
            App["📱 App"] --> Agent["⚙️ Agent Collector<br/>로컬 버퍼링, 재시도"]
        end

        subgraph GWCluster["🌐 Gateway Collector Cluster"]
            GW1["Gateway 1"]
            GW2["Gateway 2"]
            GW3["Gateway 3"]
            Role["역할:<br/>• 중앙 집중식 샘플링<br/>• 데이터 보강<br/>• 라우팅"]
        end

        Agent --> GW1
        Agent --> GW2
        Agent --> GW3
    end

    GWCluster --> J["🔍 Jaeger"]
    GWCluster --> T["📊 Tempo"]
    GWCluster --> G["📈 Grafana"]

    style App fill:#3b82f6,color:#fff
    style Agent fill:#8b5cf6,color:#fff
    style GW1 fill:#ec4899,color:#fff
    style GW2 fill:#ec4899,color:#fff
    style GW3 fill:#ec4899,color:#fff
    style J fill:#22c55e,color:#fff
    style T fill:#f59e0b,color:#fff
    style G fill:#ef4444,color:#fff
```

## Collector 배포판

### otel/opentelemetry-collector (Core)

- 필수 컴포넌트만 포함
- 가벼운 이미지
- 제한된 기능

```bash
docker pull otel/opentelemetry-collector:latest
```

### otel/opentelemetry-collector-contrib (Contrib)

- 모든 커뮤니티 기여 컴포넌트 포함
- 다양한 Receiver/Processor/Exporter
- 프로덕션 권장

```bash
docker pull otel/opentelemetry-collector-contrib:latest
```

### 포함 컴포넌트 비교

| 컴포넌트 | Core | Contrib |
|----------|------|---------|
| OTLP Receiver | ✅ | ✅ |
| Jaeger Receiver | ❌ | ✅ |
| Prometheus Receiver | ❌ | ✅ |
| Kafka Receiver | ❌ | ✅ |
| Batch Processor | ✅ | ✅ |
| Tail Sampling | ❌ | ✅ |
| K8s Attributes | ❌ | ✅ |
| Jaeger Exporter | ❌ | ✅ |
| Prometheus Exporter | ❌ | ✅ |

## 빠른 시작

### Docker로 실행

```yaml
# docker-compose.yml
version: '3.8'

services:
  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.91.0
    command: ["--config=/etc/otel-collector-config.yaml"]
    volumes:
      - ./otel-collector-config.yaml:/etc/otel-collector-config.yaml
    ports:
      - "4317:4317"   # OTLP gRPC
      - "4318:4318"   # OTLP HTTP
      - "8888:8888"   # Metrics endpoint
      - "8889:8889"   # Prometheus exporter
      - "13133:13133" # Health check
```

### 기본 설정 파일

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
  logging:
    verbosity: detailed

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [logging]
```

### 실행

```bash
docker-compose up -d
```

## 다음 단계

- [Collector 설정 상세](./collector-config) - 상세한 설정 방법
- [Jaeger 연동](./jaeger) - Jaeger 백엔드 연결
- [Tempo 연동](./tempo) - Grafana Tempo 연결
