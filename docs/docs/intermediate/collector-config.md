---
sidebar_position: 2
title: Collector 설정 상세
description: OpenTelemetry Collector의 상세한 설정 방법을 알아봅니다
---

# Collector 설정 상세

## 설정 파일 구조

```yaml
# collector-config.yaml
receivers:      # 데이터 수신 방법 정의
  ...

processors:     # 데이터 처리 방법 정의
  ...

exporters:      # 데이터 내보내기 방법 정의
  ...

extensions:     # 추가 기능 (헬스 체크, 인증 등)
  ...

service:        # 파이프라인 구성
  extensions: [...]
  pipelines:
    traces:
      receivers: [...]
      processors: [...]
      exporters: [...]
    metrics:
      receivers: [...]
      processors: [...]
      exporters: [...]
    logs:
      receivers: [...]
      processors: [...]
      exporters: [...]
```

## Receivers (수신기) 상세

### OTLP Receiver

가장 기본적이고 권장되는 수신기:

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
        max_recv_msg_size_mib: 4        # 최대 메시지 크기
        max_concurrent_streams: 100      # 최대 동시 스트림
        read_buffer_size: 524288         # 읽기 버퍼 크기
        write_buffer_size: 524288        # 쓰기 버퍼 크기
        keepalive:
          server_parameters:
            max_connection_idle: 11s
            max_connection_age: 30s
            time: 30s
            timeout: 5s
        tls:
          cert_file: /certs/server.crt
          key_file: /certs/server.key
          ca_file: /certs/ca.crt         # 클라이언트 인증서 검증

      http:
        endpoint: 0.0.0.0:4318
        cors:
          allowed_origins:
            - "http://localhost:*"
          allowed_headers:
            - "*"
        tls:
          cert_file: /certs/server.crt
          key_file: /certs/server.key
```

### Jaeger Receiver

기존 Jaeger 클라이언트와의 호환성:

```yaml
receivers:
  jaeger:
    protocols:
      grpc:
        endpoint: 0.0.0.0:14250
      thrift_http:
        endpoint: 0.0.0.0:14268
      thrift_compact:
        endpoint: 0.0.0.0:6831
      thrift_binary:
        endpoint: 0.0.0.0:6832
```

### Prometheus Receiver

Prometheus 메트릭 스크래핑:

```yaml
receivers:
  prometheus:
    config:
      scrape_configs:
        - job_name: 'otel-collector'
          scrape_interval: 15s
          static_configs:
            - targets: ['localhost:8888']

        - job_name: 'kubernetes-pods'
          kubernetes_sd_configs:
            - role: pod
          relabel_configs:
            - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
              action: keep
              regex: true
            - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
              action: replace
              target_label: __metrics_path__
              regex: (.+)
```

### Kafka Receiver

Kafka에서 텔레메트리 수신:

```yaml
receivers:
  kafka:
    protocol_version: 2.0.0
    brokers:
      - kafka:9092
    topic: otlp_spans
    encoding: otlp_proto
    group_id: otel-collector
    client_id: otel-collector
    initial_offset: latest
    auth:
      sasl:
        username: user
        password: password
        mechanism: SCRAM-SHA-512
```

### Filelog Receiver

로그 파일 수집:

```yaml
receivers:
  filelog:
    include:
      - /var/log/app/*.log
    exclude:
      - /var/log/app/debug.log
    start_at: end
    operators:
      - type: regex_parser
        regex: '^(?P<time>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) (?P<level>\w+) (?P<message>.*)$'
        timestamp:
          parse_from: attributes.time
          layout: '%Y-%m-%d %H:%M:%S'
        severity:
          parse_from: attributes.level
```

## Processors (처리기) 상세

### Batch Processor

성능 최적화를 위한 배치 처리:

```yaml
processors:
  batch:
    # 배치 전송 조건 (둘 중 하나 만족 시 전송)
    timeout: 5s              # 최대 대기 시간
    send_batch_size: 10000   # 배치당 최대 항목 수
    send_batch_max_size: 11000  # 절대 최대 (초과 시 분할)
```

### Memory Limiter Processor

메모리 사용량 제한:

```yaml
processors:
  memory_limiter:
    check_interval: 1s      # 검사 주기
    limit_mib: 1500         # 하드 제한 (MiB)
    spike_limit_mib: 500    # 스파이크 제한
    # limit_percentage: 75  # 또는 시스템 메모리의 %
```

:::warning 메모리 제한 순서
Memory Limiter는 파이프라인의 첫 번째 프로세서로 배치해야 합니다.
:::

### Attributes Processor

속성 추가/수정/삭제:

```yaml
processors:
  attributes:
    actions:
      # 새 속성 추가
      - key: environment
        value: production
        action: insert

      # 기존 속성 덮어쓰기
      - key: db.statement
        value: "REDACTED"
        action: update

      # 속성 삭제
      - key: sensitive.data
        action: delete

      # 해시 처리
      - key: user.email
        action: hash

      # 값 추출 (정규식)
      - key: http.url
        pattern: ^https?://(?P<host>[^/]+)
        action: extract
```

### Resource Processor

리소스 속성 관리:

```yaml
processors:
  resource:
    attributes:
      - key: cloud.provider
        value: aws
        action: insert
      - key: deployment.environment
        from_attribute: env
        action: insert
```

### Filter Processor

불필요한 데이터 필터링:

```yaml
processors:
  filter:
    # 에러 레벨만 유지
    error_mode: ignore
    traces:
      span:
        # health check 제외
        - 'attributes["http.target"] == "/health"'
        - 'attributes["http.target"] == "/ready"'
        - 'name == "healthcheck"'

    metrics:
      metric:
        # 특정 메트릭 제외
        - 'name == "go_gc_duration_seconds"'

    logs:
      log_record:
        # DEBUG 로그 제외
        - 'severity_number < 9'
```

### Transform Processor

OTTL(OpenTelemetry Transformation Language) 사용:

```yaml
processors:
  transform:
    error_mode: ignore
    trace_statements:
      - context: span
        statements:
          # 속성 설정
          - set(attributes["processed"], true)
          # 조건부 변환
          - set(attributes["is_error"], true) where status.code == 2
          # 이름 변경
          - replace_pattern(name, "old_", "new_")

    metric_statements:
      - context: datapoint
        statements:
          - set(attributes["normalized"], true)

    log_statements:
      - context: log
        statements:
          - set(severity_text, "ERROR") where severity_number >= 17
```

### Tail Sampling Processor

지능형 샘플링 (trace 완료 후 결정):

```yaml
processors:
  tail_sampling:
    decision_wait: 10s           # 샘플링 결정까지 대기
    num_traces: 100000           # 메모리에 보관할 trace 수
    expected_new_traces_per_sec: 1000
    policies:
      # 에러 trace는 100% 유지
      - name: errors
        type: status_code
        status_code: {status_codes: [ERROR]}

      # 느린 trace는 100% 유지
      - name: slow-traces
        type: latency
        latency: {threshold_ms: 1000}

      # 특정 서비스는 100% 유지
      - name: important-service
        type: string_attribute
        string_attribute:
          key: service.name
          values: [payment-service, auth-service]

      # 나머지는 10% 샘플링
      - name: probabilistic
        type: probabilistic
        probabilistic: {sampling_percentage: 10}
```

### K8s Attributes Processor

Kubernetes 메타데이터 자동 추가:

```yaml
processors:
  k8sattributes:
    auth_type: serviceAccount
    passthrough: false
    extract:
      metadata:
        - k8s.pod.name
        - k8s.pod.uid
        - k8s.deployment.name
        - k8s.namespace.name
        - k8s.node.name
        - k8s.pod.start_time
      labels:
        - tag_name: app
          key: app.kubernetes.io/name
        - tag_name: version
          key: app.kubernetes.io/version
    pod_association:
      - sources:
          - from: resource_attribute
            name: k8s.pod.ip
      - sources:
          - from: connection
```

## Exporters (내보내기) 상세

### OTLP Exporter

표준 OTLP 프로토콜로 전송:

```yaml
exporters:
  otlp:
    endpoint: tempo:4317
    tls:
      insecure: true
      # 또는 TLS 설정
      # cert_file: /certs/client.crt
      # key_file: /certs/client.key
      # ca_file: /certs/ca.crt
    headers:
      Authorization: "Bearer ${OTLP_AUTH_TOKEN}"
    compression: gzip
    timeout: 30s
    retry_on_failure:
      enabled: true
      initial_interval: 5s
      max_interval: 30s
      max_elapsed_time: 300s
    sending_queue:
      enabled: true
      num_consumers: 10
      queue_size: 5000
```

### Prometheus Exporter

Prometheus 메트릭 노출:

```yaml
exporters:
  prometheus:
    endpoint: 0.0.0.0:8889
    namespace: otel
    const_labels:
      environment: production
    send_timestamps: true
    metric_expiration: 5m
    resource_to_telemetry_conversion:
      enabled: true
```

### Jaeger Exporter

Jaeger 백엔드로 전송:

```yaml
exporters:
  jaeger:
    endpoint: jaeger-collector:14250
    tls:
      insecure: true
```

### Loki Exporter

Grafana Loki로 로그 전송:

```yaml
exporters:
  loki:
    endpoint: http://loki:3100/loki/api/v1/push
    labels:
      attributes:
        severity: ""
        http.status_code: "status_code"
      resource:
        service.name: "service"
        service.namespace: "namespace"
```

### Debug/Logging Exporter

디버깅용 콘솔 출력:

```yaml
exporters:
  debug:
    verbosity: detailed        # basic, normal, detailed
    sampling_initial: 5        # 첫 5개 출력
    sampling_thereafter: 200   # 이후 200개당 1개 출력
```

## Extensions (확장)

### Health Check

```yaml
extensions:
  health_check:
    endpoint: 0.0.0.0:13133
    path: /health
    check_collector_pipeline:
      enabled: true
      interval: 5m
```

### zPages

디버깅 UI 제공:

```yaml
extensions:
  zpages:
    endpoint: 0.0.0.0:55679
```

### pprof

Go 프로파일링:

```yaml
extensions:
  pprof:
    endpoint: 0.0.0.0:1777
```

### Bearer Token Auth

인증 확장:

```yaml
extensions:
  bearertokenauth:
    token: ${AUTH_TOKEN}
```

## 완전한 설정 예시

```yaml
# production-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

  prometheus:
    config:
      scrape_configs:
        - job_name: 'collector'
          scrape_interval: 10s
          static_configs:
            - targets: ['localhost:8888']

processors:
  memory_limiter:
    check_interval: 1s
    limit_mib: 2000
    spike_limit_mib: 400

  batch:
    timeout: 5s
    send_batch_size: 10000

  resource:
    attributes:
      - key: collector.name
        value: production-collector
        action: insert

  filter:
    traces:
      span:
        - 'attributes["http.target"] == "/health"'

  tail_sampling:
    decision_wait: 10s
    num_traces: 100000
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

  prometheus:
    endpoint: 0.0.0.0:8889

  debug:
    verbosity: basic

extensions:
  health_check:
    endpoint: 0.0.0.0:13133
  zpages:
    endpoint: 0.0.0.0:55679

service:
  extensions: [health_check, zpages]
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, filter, tail_sampling, batch, resource]
      exporters: [otlp/tempo, debug]
    metrics:
      receivers: [otlp, prometheus]
      processors: [memory_limiter, batch, resource]
      exporters: [prometheus]
  telemetry:
    logs:
      level: info
    metrics:
      level: detailed
      address: 0.0.0.0:8888
```

## 환경 변수 사용

```yaml
exporters:
  otlp:
    endpoint: ${OTLP_ENDPOINT}
    headers:
      Authorization: "Bearer ${AUTH_TOKEN}"
```

```bash
export OTLP_ENDPOINT=tempo:4317
export AUTH_TOKEN=your-token
```

## 다음 단계

- [Jaeger 연동](./jaeger) - Jaeger 백엔드 상세 연동
- [Tempo 연동](./tempo) - Grafana Tempo 연동
