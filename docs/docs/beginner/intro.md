---
sidebar_position: 1
title: OpenTelemetry 소개
description: OpenTelemetry가 무엇인지, 왜 필요한지 알아봅니다
---

# OpenTelemetry 소개

![OpenTelemetry](/img/content/otel-intro.svg)

## OpenTelemetry란?

**OpenTelemetry(OTel)**는 클라우드 네이티브 소프트웨어의 **관측 가능성(Observability)**을 위한 오픈소스 표준입니다. CNCF(Cloud Native Computing Foundation)의 프로젝트로, 텔레메트리 데이터(traces, metrics, logs)를 수집, 처리, 내보내기 위한 API, SDK, 도구를 제공합니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                    OpenTelemetry Ecosystem                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                  │
│  │  Traces  │    │ Metrics  │    │   Logs   │                  │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘                  │
│       │               │               │                         │
│       └───────────────┼───────────────┘                         │
│                       ▼                                          │
│            ┌─────────────────────┐                              │
│            │   OTel Collector    │                              │
│            └──────────┬──────────┘                              │
│                       │                                          │
│       ┌───────────────┼───────────────┐                         │
│       ▼               ▼               ▼                         │
│  ┌─────────┐    ┌──────────┐    ┌──────────┐                   │
│  │ Jaeger  │    │  Tempo   │    │Prometheus│                   │
│  └─────────┘    └──────────┘    └──────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 왜 OpenTelemetry가 필요한가?

### 1. 벤더 중립성 (Vendor Neutrality)

과거에는 각 APM(Application Performance Monitoring) 솔루션마다 자체 에이전트와 SDK를 사용해야 했습니다:

| 문제점 | OpenTelemetry 해결책 |
|--------|---------------------|
| 벤더 종속 (Lock-in) | 표준화된 API로 백엔드 교체 용이 |
| 중복 계측 코드 | 한 번 계측으로 여러 백엔드 지원 |
| 학습 곡선 | 통일된 개념과 API |

### 2. 통합된 관측 가능성

```
┌─────────────────────────────────────────────────────────┐
│                   Before OpenTelemetry                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   App → Jaeger Agent (Traces)                           │
│   App → Prometheus Exporter (Metrics)                   │
│   App → Fluentd (Logs)                                  │
│                                                          │
│   = 3가지 다른 라이브러리, 3가지 다른 설정              │
│                                                          │
├─────────────────────────────────────────────────────────┤
│                   After OpenTelemetry                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   App → OTel SDK → OTel Collector → Jaeger/Prometheus   │
│                                                          │
│   = 1가지 통합 라이브러리, 1가지 설정                   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 3. MSA 환경에서의 필수 요소

마이크로서비스 아키텍처에서 하나의 요청은 수십 개의 서비스를 거칠 수 있습니다:

```
사용자 요청
    │
    ▼
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Gateway │ ──▶ │ User    │ ──▶ │ Auth    │
│ Service │     │ Service │     │ Service │
└─────────┘     └────┬────┘     └─────────┘
                     │
                     ▼
                ┌─────────┐     ┌─────────┐
                │ Order   │ ──▶ │ Payment │
                │ Service │     │ Service │
                └────┬────┘     └─────────┘
                     │
                     ▼
                ┌─────────┐
                │ Notify  │
                │ Service │
                └─────────┘
```

**문제**: 어디서 지연이 발생했는지 어떻게 찾을 것인가?

**해답**: 분산 추적(Distributed Tracing)으로 전체 요청 흐름을 추적

## OpenTelemetry의 이점

### 개발자 관점

- **디버깅 시간 단축**: 분산 시스템에서 문제의 근본 원인을 빠르게 파악
- **성능 병목 발견**: 어떤 서비스가 느린지 정확히 식별
- **코드 품질 향상**: 관측 가능성을 고려한 설계 습관 형성

### 운영자 관점

- **실시간 모니터링**: 시스템 상태를 실시간으로 파악
- **알림 및 자동화**: 이상 징후 탐지 및 자동 대응
- **용량 계획**: 트래픽 패턴 분석을 통한 인프라 계획

### 비즈니스 관점

- **SLA 준수**: 서비스 수준 목표 모니터링
- **고객 경험 개선**: 성능 문제 조기 발견 및 해결
- **비용 최적화**: 리소스 사용 패턴 분석

## OpenTelemetry 역사

```
2010년대 초반: 분산 추적 시대의 시작
    │
    ├── 2012: Twitter의 Zipkin 오픈소스 공개
    │
    ├── 2015: Uber의 Jaeger 개발 시작
    │
    ├── 2016: OpenTracing 프로젝트 시작 (CNCF)
    │
    ├── 2017: OpenCensus 프로젝트 시작 (Google)
    │
    ├── 2019: OpenTracing + OpenCensus = OpenTelemetry 통합
    │
    ├── 2021: Tracing API/SDK GA (Generally Available)
    │
    ├── 2023: Metrics, Logs GA
    │
    └── 현재: CNCF Graduated 프로젝트, 업계 표준
```

## 다음 단계

이제 OpenTelemetry의 기본적인 개념을 알게 되었습니다. 다음 문서에서는:

1. [핵심 개념](./concepts) - Trace, Span, Context 등 핵심 용어 학습
2. [아키텍처](./architecture) - OTel의 구성 요소와 데이터 흐름
3. [시그널](./signals) - Traces, Metrics, Logs 상세 설명
4. [시작하기](./getting-started) - 첫 번째 OTel 애플리케이션 만들기

:::tip 학습 팁
OpenTelemetry를 처음 접한다면, 먼저 **Traces**에 집중하세요. 분산 추적을 이해하면 Metrics와 Logs도 자연스럽게 이해됩니다.
:::
