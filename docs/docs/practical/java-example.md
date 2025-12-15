---
sidebar_position: 4
title: Java 예제
description: Java/Spring Boot 애플리케이션의 상세한 OpenTelemetry 계측 예제
---

# Java 예제

## Auto-Instrumentation (권장)

가장 간단한 방법은 Java Agent를 사용하는 것입니다.

### Agent 다운로드

```bash
curl -L -O https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar
```

### 실행

```bash
java -javaagent:opentelemetry-javaagent.jar \
     -Dotel.service.name=my-java-service \
     -Dotel.exporter.otlp.endpoint=http://localhost:4317 \
     -Dotel.traces.exporter=otlp \
     -Dotel.metrics.exporter=otlp \
     -Dotel.logs.exporter=otlp \
     -jar myapp.jar
```

### 환경 변수로 설정

```bash
export OTEL_SERVICE_NAME=my-java-service
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
export OTEL_TRACES_EXPORTER=otlp
export OTEL_METRICS_EXPORTER=otlp
export OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production

java -javaagent:opentelemetry-javaagent.jar -jar myapp.jar
```

## Spring Boot 프로젝트 설정

### Maven 의존성

```xml
<!-- pom.xml -->
<dependencies>
    <!-- Spring Boot -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>

    <!-- OpenTelemetry -->
    <dependency>
        <groupId>io.opentelemetry</groupId>
        <artifactId>opentelemetry-api</artifactId>
        <version>1.33.0</version>
    </dependency>
    <dependency>
        <groupId>io.opentelemetry</groupId>
        <artifactId>opentelemetry-sdk</artifactId>
        <version>1.33.0</version>
    </dependency>
    <dependency>
        <groupId>io.opentelemetry</groupId>
        <artifactId>opentelemetry-exporter-otlp</artifactId>
        <version>1.33.0</version>
    </dependency>
    <dependency>
        <groupId>io.opentelemetry.semconv</groupId>
        <artifactId>opentelemetry-semconv</artifactId>
        <version>1.23.1-alpha</version>
    </dependency>

    <!-- OpenTelemetry Spring Boot Starter (선택) -->
    <dependency>
        <groupId>io.opentelemetry.instrumentation</groupId>
        <artifactId>opentelemetry-spring-boot-starter</artifactId>
        <version>1.33.0-alpha</version>
    </dependency>
</dependencies>
```

### Gradle 의존성

```groovy
// build.gradle
dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'

    implementation 'io.opentelemetry:opentelemetry-api:1.33.0'
    implementation 'io.opentelemetry:opentelemetry-sdk:1.33.0'
    implementation 'io.opentelemetry:opentelemetry-exporter-otlp:1.33.0'
    implementation 'io.opentelemetry.semconv:opentelemetry-semconv:1.23.1-alpha'
}
```

## 수동 계측 코드

### OTel 설정

```java
// OpenTelemetryConfig.java
package com.example.demo.config;

import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.exporter.otlp.trace.OtlpGrpcSpanExporter;
import io.opentelemetry.sdk.OpenTelemetrySdk;
import io.opentelemetry.sdk.resources.Resource;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.export.BatchSpanProcessor;
import io.opentelemetry.semconv.ResourceAttributes;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenTelemetryConfig {

    @Value("${otel.service.name:java-demo}")
    private String serviceName;

    @Value("${otel.exporter.otlp.endpoint:http://localhost:4317}")
    private String otlpEndpoint;

    @Bean
    public OpenTelemetry openTelemetry() {
        Resource resource = Resource.getDefault()
            .merge(Resource.create(Attributes.of(
                ResourceAttributes.SERVICE_NAME, serviceName,
                ResourceAttributes.SERVICE_VERSION, "1.0.0"
            )));

        OtlpGrpcSpanExporter spanExporter = OtlpGrpcSpanExporter.builder()
            .setEndpoint(otlpEndpoint)
            .build();

        SdkTracerProvider tracerProvider = SdkTracerProvider.builder()
            .addSpanProcessor(BatchSpanProcessor.builder(spanExporter).build())
            .setResource(resource)
            .build();

        return OpenTelemetrySdk.builder()
            .setTracerProvider(tracerProvider)
            .buildAndRegisterGlobal();
    }

    @Bean
    public Tracer tracer(OpenTelemetry openTelemetry) {
        return openTelemetry.getTracer("com.example.demo");
    }
}
```

### 서비스 계층

```java
// OrderService.java
package com.example.demo.service;

import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.context.Scope;
import org.springframework.stereotype.Service;

@Service
public class OrderService {

    private final Tracer tracer;

    public OrderService(Tracer tracer) {
        this.tracer = tracer;
    }

    public Order createOrder(OrderRequest request) {
        Span span = tracer.spanBuilder("create-order").startSpan();

        try (Scope scope = span.makeCurrent()) {
            span.setAttribute("order.items_count", request.getItems().size());
            span.setAttribute("order.customer_id", request.getCustomerId());

            // 재고 확인
            checkInventory(request);

            // 결제 처리
            PaymentResult payment = processPayment(request);
            span.setAttribute("payment.transaction_id", payment.getTransactionId());

            // 주문 저장
            Order order = saveOrder(request, payment);
            span.setAttribute("order.id", order.getId());

            span.setStatus(StatusCode.OK);
            return order;

        } catch (Exception e) {
            span.recordException(e);
            span.setStatus(StatusCode.ERROR, e.getMessage());
            throw e;
        } finally {
            span.end();
        }
    }

    private void checkInventory(OrderRequest request) {
        Span span = tracer.spanBuilder("check-inventory").startSpan();
        try (Scope scope = span.makeCurrent()) {
            span.setAttribute("inventory.service", "inventory-api");
            // 재고 확인 로직
            Thread.sleep(30);
            span.addEvent("inventory_checked");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            span.end();
        }
    }

    private PaymentResult processPayment(OrderRequest request) {
        Span span = tracer.spanBuilder("process-payment").startSpan();
        try (Scope scope = span.makeCurrent()) {
            span.setAttribute("payment.method", request.getPaymentMethod());
            // 결제 처리 로직
            Thread.sleep(100);
            span.addEvent("payment_completed");
            return new PaymentResult("txn-" + System.currentTimeMillis());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException(e);
        } finally {
            span.end();
        }
    }

    private Order saveOrder(OrderRequest request, PaymentResult payment) {
        Span span = tracer.spanBuilder("save-order").startSpan();
        try (Scope scope = span.makeCurrent()) {
            span.setAttribute("db.system", "postgresql");
            span.setAttribute("db.operation", "INSERT");
            // DB 저장 로직
            Thread.sleep(20);
            return new Order("order-" + System.currentTimeMillis());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException(e);
        } finally {
            span.end();
        }
    }
}
```

### 컨트롤러

```java
// OrderController.java
package com.example.demo.controller;

import com.example.demo.service.OrderService;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.Tracer;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;
    private final Tracer tracer;

    public OrderController(OrderService orderService, Tracer tracer) {
        this.orderService = orderService;
        this.tracer = tracer;
    }

    @PostMapping
    public ResponseEntity<Order> createOrder(@RequestBody OrderRequest request) {
        Span span = Span.current();
        span.setAttribute("http.request.body.size", request.toString().length());

        Order order = orderService.createOrder(request);
        return ResponseEntity.ok(order);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Order> getOrder(@PathVariable String id) {
        Span span = Span.current();
        span.setAttribute("order.id", id);

        // 주문 조회 로직
        return ResponseEntity.ok(new Order(id));
    }
}
```

## Dockerfile

```dockerfile
# Dockerfile
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# OTel Java Agent 다운로드
ADD https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar /app/opentelemetry-javaagent.jar

COPY target/*.jar app.jar

ENV JAVA_TOOL_OPTIONS="-javaagent:/app/opentelemetry-javaagent.jar"

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
```

## Kubernetes 배포

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: java-demo
spec:
  replicas: 2
  selector:
    matchLabels:
      app: java-demo
  template:
    metadata:
      labels:
        app: java-demo
    spec:
      containers:
        - name: java-demo
          image: java-demo:latest
          ports:
            - containerPort: 8080
          env:
            - name: OTEL_SERVICE_NAME
              value: "java-demo"
            - name: OTEL_EXPORTER_OTLP_ENDPOINT
              value: "http://otel-collector:4317"
            - name: OTEL_TRACES_EXPORTER
              value: "otlp"
            - name: OTEL_METRICS_EXPORTER
              value: "otlp"
            - name: JAVA_TOOL_OPTIONS
              value: "-javaagent:/app/opentelemetry-javaagent.jar"
```

## 다음 단계

- [Python 예제](./python-example) - Python 상세 계측
- [Go 예제](./go-example) - Go 상세 계측
