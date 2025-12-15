---
slug: /
sidebar_position: 0
title: 홈
---

# OpenTelemetry 완벽 가이드

분산 추적과 관측 가능성을 마스터하기 위한 종합 가이드입니다.

```
┌─────────────────────────────────────────────────────────────────┐
│               OpenTelemetry Ecosystem                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   📱 Applications                                                │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐              │
│   │ Node.js │ │  Java   │ │ Python  │ │   Go    │              │
│   │   SDK   │ │   SDK   │ │   SDK   │ │   SDK   │              │
│   └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘              │
│        │           │           │           │                    │
│        └───────────┴───────────┴───────────┘                    │
│                          │                                       │
│                          ▼                                       │
│   ⚙️ OTel Collector                                              │
│   ┌──────────────────────────────────────────────────────────┐ │
│   │  Receivers → Processors → Exporters                       │ │
│   └──────────────────────────────────────────────────────────┘ │
│                          │                                       │
│        ┌─────────────────┼─────────────────┐                    │
│        ▼                 ▼                 ▼                    │
│   ┌─────────┐      ┌──────────┐      ┌─────────┐              │
│   │ Jaeger  │      │  Tempo   │      │Prometheus│              │
│   └─────────┘      └──────────┘      └─────────┘              │
│        │                 │                 │                    │
│        └─────────────────┼─────────────────┘                    │
│                          ▼                                       │
│                    ┌──────────┐                                 │
│                    │ Grafana  │                                 │
│                    └──────────┘                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 학습 경로

### 기초 (Beginner)

OpenTelemetry를 처음 접하는 분들을 위한 기본 개념과 시작 가이드입니다.

- [OpenTelemetry 소개](./beginner/intro) - OTel이란 무엇인가?
- [핵심 개념](./beginner/concepts) - Trace, Span, Context 이해하기
- [아키텍처](./beginner/architecture) - OTel 구성 요소 이해
- [시그널](./beginner/signals) - Traces, Metrics, Logs 상세
- [시작하기](./beginner/getting-started) - 첫 번째 OTel 앱 만들기

### 중급 (Intermediate)

OTel Collector와 백엔드 시스템을 연동하는 방법을 배웁니다.

- [OTel Collector](./intermediate/collector) - Collector 이해하기
- [Collector 설정](./intermediate/collector-config) - 상세 설정 방법
- [Jaeger 연동](./intermediate/jaeger) - Jaeger 백엔드 연결
- [Tempo 연동](./intermediate/tempo) - Grafana Tempo 연결
- [계측](./intermediate/instrumentation) - 다양한 계측 방법
- [Context 전파](./intermediate/context-propagation) - 서비스 간 컨텍스트 전달

### 고급 (Advanced)

프로덕션 환경에서 OTel을 운영하는 고급 기술을 다룹니다.

- [MSA 아키텍처](./advanced/msa-architecture) - 마이크로서비스 설계
- [샘플링 전략](./advanced/sampling-strategies) - 효율적인 샘플링
- [프로덕션 배포](./advanced/production-deployment) - 프로덕션 배포 가이드
- [성능 최적화](./advanced/performance-optimization) - 성능 튜닝
- [보안](./advanced/security) - 보안 강화
- [트러블슈팅](./advanced/troubleshooting) - 문제 해결

### 실습 (Practical)

실제 코드와 함께 배우는 실습 가이드입니다.

- [Docker Compose 실습](./practical/docker-compose-setup) - 전체 스택 구성
- [Kubernetes 배포](./practical/kubernetes-deployment) - K8s 환경 배포
- [Node.js 예제](./practical/nodejs-example) - Node.js 상세 계측
- [Java 예제](./practical/java-example) - Java/Spring 계측
- [Python 예제](./practical/python-example) - Python/FastAPI 계측
- [Go 예제](./practical/go-example) - Go 계측

### 실제 사례 연구 (Case Studies) 🆕

글로벌 기업들의 OpenTelemetry 도입 성과와 교훈입니다.

- [엔터프라이즈 성공 사례](./casestudies/enterprise-success) - eBay, GitHub, Shopify 등의 실제 성과
- [ROI 분석 및 도입 전략](./casestudies/roi-analysis) - 비용 대비 효과와 전략적 접근
- [마이그레이션 가이드](./casestudies/migration-guide) - 기존 시스템에서 안전하게 전환하기

## OpenTelemetry의 이점

| 영역 | 이점 |
|------|------|
| **개발** | 통합된 API로 일관된 계측, 벤더 종속성 제거 |
| **운영** | 분산 시스템 가시성, 빠른 문제 진단 |
| **비즈니스** | SLO 모니터링, 고객 경험 개선 |

## 빠른 시작

```bash
# Docker로 빠른 시작
docker run -d --name jaeger \
  -p 16686:16686 \
  -p 4317:4317 \
  -p 4318:4318 \
  -e COLLECTOR_OTLP_ENABLED=true \
  jaegertracing/all-in-one:1.53

# Jaeger UI: http://localhost:16686
# OTLP gRPC: localhost:4317
# OTLP HTTP: localhost:4318
```

## 공식 자료

- [OpenTelemetry 공식 사이트](https://opentelemetry.io)
- [OpenTelemetry GitHub](https://github.com/open-telemetry)
- [Jaeger](https://www.jaegertracing.io)
- [Grafana Tempo](https://grafana.com/oss/tempo/)
