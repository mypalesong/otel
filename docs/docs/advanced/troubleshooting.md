---
sidebar_position: 6
title: 트러블슈팅
description: OpenTelemetry 관련 문제를 진단하고 해결하는 방법을 알아봅니다
---

# 트러블슈팅

## 일반적인 문제 진단 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│               Troubleshooting Decision Tree                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  트레이스가 보이지 않음                                          │
│  │                                                              │
│  ├─▶ SDK가 초기화되었는가?                                      │
│  │   └─▶ 로그에서 OTel 초기화 확인                              │
│  │                                                              │
│  ├─▶ Exporter가 연결되었는가?                                   │
│  │   └─▶ 네트워크 연결 테스트                                   │
│  │                                                              │
│  ├─▶ Collector가 수신 중인가?                                   │
│  │   └─▶ Collector 메트릭/로그 확인                             │
│  │                                                              │
│  ├─▶ 샘플링되고 있는가?                                         │
│  │   └─▶ 샘플러 설정 확인                                       │
│  │                                                              │
│  └─▶ 백엔드가 정상인가?                                         │
│      └─▶ 백엔드 상태 확인                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## SDK 문제

### 트레이스가 생성되지 않음

**증상**: 애플리케이션 실행 후 백엔드에 트레이스가 없음

**진단**:

```python
# Python - 디버그 로깅 활성화
import logging
logging.basicConfig(level=logging.DEBUG)

# SDK 상태 확인
from opentelemetry import trace
tracer = trace.get_tracer(__name__)
print(f"Tracer: {tracer}")
print(f"Provider: {trace.get_tracer_provider()}")
```

```javascript
// Node.js - 디버그 활성화
const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
```

**해결책**:

```python
# 1. SDK 초기화가 먼저 되어야 함
# ❌ 잘못된 순서
from flask import Flask
app = Flask(__name__)
# ... 나중에 OTel 초기화

# ✅ 올바른 순서
# tracing.py를 먼저 import
import tracing  # SDK 초기화
from flask import Flask
app = Flask(__name__)
```

### Context가 전파되지 않음

**증상**: 서비스 간 호출 시 trace_id가 다름

**진단**:

```python
# 현재 context 확인
from opentelemetry import trace
span = trace.get_current_span()
if span:
    ctx = span.get_span_context()
    print(f"Trace ID: {format(ctx.trace_id, '032x')}")
    print(f"Span ID: {format(ctx.span_id, '016x')}")
else:
    print("No active span!")

# 헤더 확인
from opentelemetry.propagate import inject
headers = {}
inject(headers)
print(f"Headers: {headers}")
```

**해결책**:

```python
# HTTP 클라이언트에서 자동 계측 확인
from opentelemetry.instrumentation.requests import RequestsInstrumentor
RequestsInstrumentor().instrument()

# 또는 수동으로 헤더 주입
import requests
from opentelemetry.propagate import inject

headers = {}
inject(headers)
response = requests.get(url, headers=headers)
```

## Collector 문제

### Collector가 시작되지 않음

**진단**:

```bash
# 로그 확인
docker logs otel-collector 2>&1 | tail -50

# 설정 검증
otelcol validate --config=config.yaml

# 상태 확인
curl http://localhost:13133/health
```

**일반적인 원인**:

```yaml
# ❌ 잘못된 설정 - 포트 충돌
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
  jaeger:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317  # 포트 충돌!

# ✅ 수정
receivers:
  jaeger:
    protocols:
      grpc:
        endpoint: 0.0.0.0:14250
```

### Collector가 데이터를 수신하지 않음

**진단**:

```bash
# Collector 메트릭 확인
curl -s http://localhost:8888/metrics | grep otelcol_receiver

# 예상 출력
# otelcol_receiver_accepted_spans{...} > 0
# otelcol_receiver_refused_spans{...} = 0
```

**해결책**:

```yaml
# 1. Receiver 설정 확인
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317  # 0.0.0.0 확인 (localhost가 아님)

# 2. 서비스 파이프라인에 연결 확인
service:
  pipelines:
    traces:
      receivers: [otlp]  # receiver가 파이프라인에 있는지 확인
```

### Collector 메모리 부족

**증상**: OOMKilled, 성능 저하

**진단**:

```promql
# 메모리 사용량 확인
process_resident_memory_bytes{job="otel-collector"}

# 큐 크기 확인
otelcol_exporter_queue_size
```

**해결책**:

```yaml
processors:
  # Memory Limiter 추가 (파이프라인 첫 번째에)
  memory_limiter:
    check_interval: 1s
    limit_mib: 1500
    spike_limit_mib: 300

  # 배치 크기 줄이기
  batch:
    timeout: 2s
    send_batch_size: 500

service:
  pipelines:
    traces:
      processors: [memory_limiter, batch]  # memory_limiter가 첫 번째
```

### Export 실패

**증상**: `otelcol_exporter_send_failed_spans` 증가

**진단**:

```bash
# Collector 로그에서 에러 확인
docker logs otel-collector 2>&1 | grep -i error

# 네트워크 연결 테스트
docker exec otel-collector nc -zv tempo 4317
```

**해결책**:

```yaml
exporters:
  otlp:
    endpoint: tempo:4317
    tls:
      insecure: true  # 또는 적절한 TLS 설정
    retry_on_failure:
      enabled: true
      initial_interval: 5s
      max_interval: 30s
      max_elapsed_time: 300s
    sending_queue:
      enabled: true
      num_consumers: 10
      queue_size: 5000
    timeout: 30s
```

## 백엔드 문제

### Jaeger에서 트레이스가 보이지 않음

**진단**:

```bash
# Jaeger 상태 확인
curl http://localhost:16686/api/services

# Collector 로그 확인
docker logs jaeger 2>&1 | grep -i error
```

**해결책**:

```yaml
# OTLP 활성화 확인
environment:
  - COLLECTOR_OTLP_ENABLED=true

# 또는 올바른 포트 사용
exporters:
  jaeger:
    endpoint: jaeger:14250  # gRPC 포트
```

### Tempo에서 검색이 안됨

**증상**: Trace ID로만 검색 가능, 서비스별 검색 불가

**원인**: Tempo는 기본적으로 Trace ID 기반 조회만 지원

**해결책**:

```yaml
# Tempo Metrics Generator 활성화
metrics_generator:
  registry:
    external_labels:
      source: tempo
  storage:
    path: /var/tempo/generator/wal
    remote_write:
      - url: http://prometheus:9090/api/v1/write
        send_exemplars: true
  processor:
    service_graphs:
      wait: 10s
    span_metrics:
      dimensions:
        - service.name
        - http.method
```

## 네트워크 문제

### 연결 타임아웃

**진단**:

```bash
# DNS 확인
nslookup collector.monitoring.svc.cluster.local

# 포트 연결 테스트
nc -zv collector.monitoring 4317

# gRPC 연결 테스트
grpcurl -plaintext collector.monitoring:4317 list
```

**해결책**:

```yaml
# 타임아웃 조정
exporters:
  otlp:
    endpoint: collector:4317
    timeout: 60s
    sending_queue:
      num_consumers: 20
```

### TLS 인증서 에러

**증상**: `x509: certificate signed by unknown authority`

**진단**:

```bash
# 인증서 확인
openssl s_client -connect collector:4317 -servername collector </dev/null 2>/dev/null | openssl x509 -text

# 인증서 체인 확인
openssl verify -CAfile ca.crt server.crt
```

**해결책**:

```yaml
# 올바른 CA 인증서 지정
exporters:
  otlp:
    endpoint: collector:4317
    tls:
      ca_file: /certs/ca.crt
      cert_file: /certs/client.crt
      key_file: /certs/client.key
      insecure: false
```

## 성능 문제

### 높은 지연 시간

**진단**:

```promql
# Exporter 지연 시간
histogram_quantile(0.99, rate(otelcol_exporter_send_latency_bucket[5m]))

# 배치 크기
avg(otelcol_processor_batch_batch_send_size)
```

**해결책**:

```yaml
processors:
  batch:
    timeout: 2s  # 더 빠른 플러시
    send_batch_size: 500  # 작은 배치

exporters:
  otlp:
    sending_queue:
      num_consumers: 20  # 병렬 처리 증가
```

### 데이터 손실

**증상**: `otelcol_processor_dropped_spans` > 0

**진단**:

```promql
# 드롭된 span 확인
rate(otelcol_processor_dropped_spans[5m])

# 큐 용량 확인
otelcol_exporter_queue_size / otelcol_exporter_queue_capacity
```

**해결책**:

```yaml
processors:
  memory_limiter:
    limit_mib: 3000  # 메모리 증가

exporters:
  otlp:
    sending_queue:
      queue_size: 10000  # 큐 크기 증가
```

## 디버깅 도구

### Console Exporter

```yaml
# 디버깅용 로깅 활성화
exporters:
  debug:
    verbosity: detailed
    sampling_initial: 5
    sampling_thereafter: 200

service:
  pipelines:
    traces:
      exporters: [otlp, debug]  # 추가
```

### zpages 활성화

```yaml
extensions:
  zpages:
    endpoint: localhost:55679

service:
  extensions: [zpages]
```

```bash
# zpages 접근
curl http://localhost:55679/debug/tracez
curl http://localhost:55679/debug/pipelinez
```

### pprof 프로파일링

```yaml
extensions:
  pprof:
    endpoint: localhost:1777

service:
  extensions: [pprof]
```

```bash
# CPU 프로파일
go tool pprof http://localhost:1777/debug/pprof/profile?seconds=30

# 메모리 프로파일
go tool pprof http://localhost:1777/debug/pprof/heap

# Goroutine 덤프
curl http://localhost:1777/debug/pprof/goroutine?debug=1
```

## 체크리스트

```
┌─────────────────────────────────────────────────────────────────┐
│              Troubleshooting Checklist                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  SDK 레벨                                                        │
│  [ ] SDK가 초기화되었는가?                                      │
│  [ ] 올바른 Exporter가 설정되었는가?                            │
│  [ ] Endpoint가 올바른가?                                       │
│  [ ] 샘플러가 DROP하고 있지 않은가?                             │
│  [ ] Context가 올바르게 전파되는가?                             │
│                                                                  │
│  Collector 레벨                                                  │
│  [ ] Collector가 실행 중인가?                                   │
│  [ ] Receiver가 올바른 포트를 리스닝하는가?                     │
│  [ ] 파이프라인이 올바르게 구성되었는가?                        │
│  [ ] Memory Limiter가 설정되었는가?                             │
│  [ ] Export 에러가 있는가?                                      │
│                                                                  │
│  네트워크 레벨                                                   │
│  [ ] DNS가 해석되는가?                                          │
│  [ ] 포트가 열려있는가?                                         │
│  [ ] TLS 인증서가 유효한가?                                     │
│  [ ] 방화벽/NetworkPolicy가 허용하는가?                         │
│                                                                  │
│  백엔드 레벨                                                     │
│  [ ] 백엔드가 정상 동작하는가?                                  │
│  [ ] 스토리지 용량이 충분한가?                                  │
│  [ ] 인덱스/쿼리가 정상인가?                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```
