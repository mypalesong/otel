---
sidebar_position: 4
title: Grafana Tempo 연동
description: Grafana Tempo와 OpenTelemetry를 연동하여 대규모 트레이싱을 구현합니다
---

# Grafana Tempo 연동

## Tempo란?

**Grafana Tempo**는 Grafana Labs에서 개발한 고성능, 비용 효율적인 분산 추적 백엔드입니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                      Tempo vs Jaeger                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  특성              Tempo                    Jaeger               │
│  ─────────────────────────────────────────────────────────────  │
│  인덱싱            없음 (Trace ID만)        전체 인덱싱          │
│  스토리지 비용     매우 낮음                 높음                 │
│  검색 방식         Trace ID 필요            태그/속성 검색       │
│  확장성            매우 높음                 중간                 │
│  Grafana 통합      네이티브                  플러그인            │
│  운영 복잡도       낮음                      중간                 │
│                                                                  │
│  선택 가이드:                                                    │
│  • 비용 중시 + Grafana 사용 → Tempo                             │
│  • 고급 검색 필요 → Jaeger + Elasticsearch                      │
│  • 둘 다 사용 가능 (Collector로 분기)                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Tempo 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                      Tempo Architecture                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     Distributor                          │   │
│  │  • 트레이스 수신 (OTLP, Jaeger, Zipkin)                  │   │
│  │  • 데이터 검증                                           │   │
│  │  • Ingester로 분배 (consistent hashing)                  │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      Ingester                            │   │
│  │  • 메모리에 트레이스 버퍼링                              │   │
│  │  • 배치로 블록 생성                                      │   │
│  │  • 로컬 디스크에 WAL 저장                                │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      Compactor                           │   │
│  │  • 블록 압축 및 병합                                     │   │
│  │  • 인덱스 최적화                                         │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Object Storage                         │   │
│  │  • S3, GCS, Azure Blob, MinIO                           │   │
│  │  • 장기 저장소                                           │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                       Querier                            │   │
│  │  • Trace ID로 조회                                       │   │
│  │  • Ingester + Storage 검색                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 배포 방식

### 1. 단일 바이너리 모드 (개발/테스트)

```yaml
# docker-compose.yml
version: '3.8'

services:
  tempo:
    image: grafana/tempo:2.3.1
    command: ["-config.file=/etc/tempo.yaml"]
    volumes:
      - ./tempo.yaml:/etc/tempo.yaml
      - tempo_data:/var/tempo
    ports:
      - "3200:3200"   # Tempo API
      - "4317:4317"   # OTLP gRPC
      - "4318:4318"   # OTLP HTTP
      - "9411:9411"   # Zipkin

  grafana:
    image: grafana/grafana:10.2.0
    ports:
      - "3000:3000"
    environment:
      - GF_AUTH_ANONYMOUS_ENABLED=true
      - GF_AUTH_ANONYMOUS_ORG_ROLE=Admin
    volumes:
      - ./grafana-datasources.yaml:/etc/grafana/provisioning/datasources/datasources.yaml

volumes:
  tempo_data:
```

### Tempo 설정 파일

```yaml
# tempo.yaml
stream_over_http_enabled: true

server:
  http_listen_port: 3200
  grpc_listen_port: 9095

query_frontend:
  search:
    duration_slo: 5s
    throughput_bytes_slo: 1.073741824e+09
  trace_by_id:
    duration_slo: 5s

distributor:
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
        grpc:
          endpoint: 0.0.0.0:14250
    zipkin:
      endpoint: 0.0.0.0:9411

ingester:
  max_block_duration: 5m

compactor:
  compaction:
    block_retention: 48h

metrics_generator:
  registry:
    external_labels:
      source: tempo
      cluster: docker-compose
  storage:
    path: /var/tempo/generator/wal
    remote_write:
      - url: http://prometheus:9090/api/v1/write
        send_exemplars: true

storage:
  trace:
    backend: local
    wal:
      path: /var/tempo/wal
    local:
      path: /var/tempo/blocks

overrides:
  defaults:
    metrics_generator:
      processors: [service-graphs, span-metrics]
```

### Grafana 데이터소스 설정

```yaml
# grafana-datasources.yaml
apiVersion: 1

datasources:
  - name: Tempo
    type: tempo
    access: proxy
    url: http://tempo:3200
    isDefault: true
    jsonData:
      httpMethod: GET
      tracesToLogs:
        datasourceUid: 'loki'
        tags: ['job', 'instance', 'pod', 'namespace']
        mappedTags: [{ key: 'service.name', value: 'service' }]
        mapTagNamesEnabled: true
        spanStartTimeShift: '1h'
        spanEndTimeShift: '1h'
        filterByTraceID: true
        filterBySpanID: true
      tracesToMetrics:
        datasourceUid: 'prometheus'
        tags: [{ key: 'service.name', value: 'service' }]
        queries:
          - name: 'Request Rate'
            query: 'sum(rate(traces_spanmetrics_calls_total{$$__tags}[5m]))'
          - name: 'Error Rate'
            query: 'sum(rate(traces_spanmetrics_calls_total{$$__tags,status_code="STATUS_CODE_ERROR"}[5m]))'
      serviceMap:
        datasourceUid: 'prometheus'
      search:
        hide: false
      nodeGraph:
        enabled: true
      lokiSearch:
        datasourceUid: 'loki'
```

### 2. 분산 모드 (프로덕션)

```yaml
# docker-compose-distributed.yml
version: '3.8'

services:
  # MinIO for object storage
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      - MINIO_ROOT_USER=tempo
      - MINIO_ROOT_PASSWORD=supersecret
    volumes:
      - minio_data:/data

  # Create bucket
  createbuckets:
    image: minio/mc:latest
    depends_on:
      - minio
    entrypoint: >
      /bin/sh -c "
      sleep 5;
      mc alias set myminio http://minio:9000 tempo supersecret;
      mc mb myminio/tempo-traces --ignore-existing;
      exit 0;
      "

  # Tempo Distributor
  tempo-distributor:
    image: grafana/tempo:2.3.1
    command: ["-config.file=/etc/tempo.yaml", "-target=distributor"]
    volumes:
      - ./tempo-distributed.yaml:/etc/tempo.yaml
    ports:
      - "4317:4317"
      - "4318:4318"
    depends_on:
      - tempo-ingester

  # Tempo Ingester
  tempo-ingester:
    image: grafana/tempo:2.3.1
    command: ["-config.file=/etc/tempo.yaml", "-target=ingester"]
    volumes:
      - ./tempo-distributed.yaml:/etc/tempo.yaml
      - tempo_ingester_data:/var/tempo
    depends_on:
      - minio

  # Tempo Query Frontend
  tempo-query-frontend:
    image: grafana/tempo:2.3.1
    command: ["-config.file=/etc/tempo.yaml", "-target=query-frontend"]
    volumes:
      - ./tempo-distributed.yaml:/etc/tempo.yaml
    ports:
      - "3200:3200"
    depends_on:
      - tempo-querier

  # Tempo Querier
  tempo-querier:
    image: grafana/tempo:2.3.1
    command: ["-config.file=/etc/tempo.yaml", "-target=querier"]
    volumes:
      - ./tempo-distributed.yaml:/etc/tempo.yaml
    depends_on:
      - tempo-ingester

  # Tempo Compactor
  tempo-compactor:
    image: grafana/tempo:2.3.1
    command: ["-config.file=/etc/tempo.yaml", "-target=compactor"]
    volumes:
      - ./tempo-distributed.yaml:/etc/tempo.yaml
    depends_on:
      - minio

volumes:
  minio_data:
  tempo_ingester_data:
```

### 분산 모드 Tempo 설정

```yaml
# tempo-distributed.yaml
multitenancy_enabled: false

server:
  http_listen_port: 3200

distributor:
  receivers:
    otlp:
      protocols:
        grpc:
          endpoint: 0.0.0.0:4317
        http:
          endpoint: 0.0.0.0:4318

ingester:
  lifecycler:
    ring:
      kvstore:
        store: memberlist
      replication_factor: 1

memberlist:
  join_members:
    - tempo-ingester:7946

compactor:
  ring:
    kvstore:
      store: memberlist
  compaction:
    block_retention: 168h  # 7 days

storage:
  trace:
    backend: s3
    s3:
      bucket: tempo-traces
      endpoint: minio:9000
      access_key: tempo
      secret_key: supersecret
      insecure: true
    wal:
      path: /var/tempo/wal
    pool:
      max_workers: 100
      queue_depth: 10000
```

## OTel Collector 연동

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
    timeout: 5s
    send_batch_size: 10000

  tail_sampling:
    decision_wait: 10s
    policies:
      - name: errors
        type: status_code
        status_code: {status_codes: [ERROR]}
      - name: slow
        type: latency
        latency: {threshold_ms: 500}
      - name: probabilistic
        type: probabilistic
        probabilistic: {sampling_percentage: 10}

exporters:
  otlp/tempo:
    endpoint: tempo:4317
    tls:
      insecure: true

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [tail_sampling, batch]
      exporters: [otlp/tempo]
```

## Tempo Metrics Generator

Trace에서 자동으로 메트릭 생성:

```yaml
# tempo.yaml에 추가
metrics_generator:
  registry:
    external_labels:
      source: tempo
  storage:
    path: /var/tempo/generator/wal
    remote_write:
      - url: http://prometheus:9090/api/v1/write
        send_exemplars: true
  traces_storage:
    path: /var/tempo/generator/traces
  processor:
    service_graphs:
      dimensions:
        - service.namespace
        - service.version
      wait: 10s
      max_items: 10000
    span_metrics:
      dimensions:
        - service.namespace
        - http.method
        - http.status_code
      histogram_buckets: [0.002, 0.004, 0.008, 0.016, 0.032, 0.064, 0.128, 0.256, 0.512, 1.024, 2.048, 4.096, 8.192, 16.384]
```

### 생성되는 메트릭

```
# Service Graph 메트릭
traces_service_graph_request_total{client="frontend", server="backend"}
traces_service_graph_request_failed_total{...}
traces_service_graph_request_server_seconds_bucket{...}

# Span 메트릭
traces_spanmetrics_latency_bucket{service="order-service", span_name="GET /api/orders",...}
traces_spanmetrics_calls_total{...}
traces_spanmetrics_size_total{...}
```

## Grafana에서 Tempo 사용

### Trace 검색

```
┌─────────────────────────────────────────────────────────────────┐
│                 Grafana - Explore - Tempo                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Query Type: [Search ▼]                                         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Service Name: [order-service    ]                        │   │
│  │ Span Name:    [POST /api/orders ]                        │   │
│  │ Duration:     [> 100ms          ]                        │   │
│  │ Status:       [error            ]                        │   │
│  │                                                          │   │
│  │ Tags:                                                    │   │
│  │   http.method = POST                                     │   │
│  │   + Add tag                                              │   │
│  │                                                          │   │
│  │ [Run Query]                                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Results:                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Trace ID          Service         Duration    Spans     │   │
│  │ ────────────────────────────────────────────────────── │   │
│  │ abc123def456      order-service   523ms       12        │   │
│  │ xyz789ghi012      order-service   312ms       8         │   │
│  │ ...                                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### TraceQL 쿼리 언어

Tempo 2.0+에서 지원하는 강력한 쿼리 언어:

```
# 기본 검색
{ status = error }

# 서비스 검색
{ resource.service.name = "order-service" }

# 속성 검색
{ span.http.status_code >= 400 }

# 지연 시간 검색
{ duration > 500ms }

# 복합 조건
{ resource.service.name = "order-service" && span.http.method = "POST" && duration > 100ms }

# Span 이름 패턴
{ name =~ ".*order.*" }
```

### Service Map

Tempo Metrics Generator와 함께 사용:

```
┌─────────────────────────────────────────────────────────────────┐
│                      Service Map                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                      ┌──────────┐                               │
│                      │ frontend │                               │
│                      │  50 req/s│                               │
│                      └────┬─────┘                               │
│                           │                                      │
│            ┌──────────────┼──────────────┐                      │
│            │              │              │                       │
│            ▼              ▼              ▼                       │
│     ┌──────────┐   ┌──────────┐   ┌──────────┐                 │
│     │ user-svc │   │order-svc │   │ auth-svc │                 │
│     │  20 req/s│   │  30 req/s│   │  50 req/s│                 │
│     │  p99: 45ms│   │ p99:120ms│   │  p99: 10ms│                 │
│     └──────────┘   └────┬─────┘   └──────────┘                 │
│                         │                                        │
│            ┌────────────┴────────────┐                          │
│            ▼                         ▼                           │
│     ┌──────────┐              ┌──────────┐                      │
│     │payment-  │              │ order-db │                      │
│     │  svc     │              │ (postgres)│                      │
│     │  1% error│              │ p99: 15ms │                      │
│     └──────────┘              └──────────┘                      │
│                                                                  │
│  [Legend: Size=Request rate, Color=Error rate]                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 프로덕션 고려사항

### 스토리지 용량 계산

```
일일 Span 수: 1억 개
평균 Span 크기: 1KB
압축률: 10:1

일일 원시 데이터: 100GB
압축 후: 10GB
보관 기간 7일: 70GB

여유 포함 권장: 100GB+
```

### 성능 튜닝

```yaml
# tempo.yaml
query_frontend:
  max_retries: 5
  search:
    concurrent_jobs: 1000
    target_bytes_per_job: 104857600  # 100MB

querier:
  max_concurrent_queries: 20
  search:
    prefer_self: 10
    external_endpoints: []

ingester:
  max_block_bytes: 1073741824  # 1GB
  max_block_duration: 30m
  complete_block_timeout: 15m
```

## 다음 단계

- [계측](./instrumentation) - 애플리케이션 계측 방법
- [Context Propagation](./context-propagation) - 컨텍스트 전파
