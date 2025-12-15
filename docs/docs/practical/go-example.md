---
sidebar_position: 6
title: Go 예제
description: Go 애플리케이션의 상세한 OpenTelemetry 계측 예제
---

# Go 예제

## 프로젝트 설정

```bash
mkdir go-otel-demo && cd go-otel-demo
go mod init go-otel-demo
```

### 의존성 설치

```bash
go get go.opentelemetry.io/otel
go get go.opentelemetry.io/otel/sdk
go get go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc
go get go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp
go get github.com/gin-gonic/gin
```

## 코드

### 트레이싱 설정

```go
// telemetry/telemetry.go
package telemetry

import (
    "context"
    "log"
    "os"
    "time"

    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/attribute"
    "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
    "go.opentelemetry.io/otel/propagation"
    "go.opentelemetry.io/otel/sdk/resource"
    sdktrace "go.opentelemetry.io/otel/sdk/trace"
    semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
    "google.golang.org/grpc"
    "google.golang.org/grpc/credentials/insecure"
)

func InitTelemetry(ctx context.Context) func() {
    endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    if endpoint == "" {
        endpoint = "localhost:4317"
    }

    serviceName := os.Getenv("OTEL_SERVICE_NAME")
    if serviceName == "" {
        serviceName = "go-demo"
    }

    // OTLP Exporter 생성
    conn, err := grpc.DialContext(ctx, endpoint,
        grpc.WithTransportCredentials(insecure.NewCredentials()),
        grpc.WithBlock(),
    )
    if err != nil {
        log.Fatalf("Failed to connect to collector: %v", err)
    }

    exporter, err := otlptracegrpc.New(ctx, otlptracegrpc.WithGRPCConn(conn))
    if err != nil {
        log.Fatalf("Failed to create exporter: %v", err)
    }

    // Resource 정의
    res, err := resource.Merge(
        resource.Default(),
        resource.NewWithAttributes(
            semconv.SchemaURL,
            semconv.ServiceName(serviceName),
            semconv.ServiceVersion("1.0.0"),
            attribute.String("environment", os.Getenv("ENVIRONMENT")),
        ),
    )
    if err != nil {
        log.Fatalf("Failed to create resource: %v", err)
    }

    // TracerProvider 생성
    tp := sdktrace.NewTracerProvider(
        sdktrace.WithBatcher(exporter,
            sdktrace.WithBatchTimeout(5*time.Second),
            sdktrace.WithMaxExportBatchSize(512),
        ),
        sdktrace.WithResource(res),
        sdktrace.WithSampler(sdktrace.AlwaysSample()),
    )

    // 전역 설정
    otel.SetTracerProvider(tp)
    otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
        propagation.TraceContext{},
        propagation.Baggage{},
    ))

    // Cleanup 함수 반환
    return func() {
        ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
        defer cancel()
        if err := tp.Shutdown(ctx); err != nil {
            log.Printf("Error shutting down tracer provider: %v", err)
        }
    }
}
```

### 메인 애플리케이션

```go
// main.go
package main

import (
    "context"
    "log"
    "net/http"
    "os"
    "os/signal"
    "syscall"

    "go-otel-demo/handlers"
    "go-otel-demo/telemetry"

    "github.com/gin-gonic/gin"
    "go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
)

func main() {
    ctx := context.Background()

    // Telemetry 초기화
    shutdown := telemetry.InitTelemetry(ctx)
    defer shutdown()

    // Gin 라우터 설정
    router := gin.Default()

    // OTel 미들웨어 추가
    router.Use(otelgin.Middleware("go-demo"))

    // 라우트 등록
    router.GET("/health", handlers.Health)
    router.POST("/api/orders", handlers.CreateOrder)
    router.GET("/api/orders/:id", handlers.GetOrder)
    router.GET("/api/users/:id", handlers.GetUser)

    // 서버 시작
    srv := &http.Server{
        Addr:    ":8080",
        Handler: router,
    }

    go func() {
        if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatalf("Failed to start server: %v", err)
        }
    }()

    // Graceful shutdown
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit

    log.Println("Shutting down server...")
    if err := srv.Shutdown(ctx); err != nil {
        log.Fatal("Server forced to shutdown:", err)
    }
}
```

### 핸들러

```go
// handlers/handlers.go
package handlers

import (
    "context"
    "fmt"
    "math/rand"
    "net/http"
    "time"

    "github.com/gin-gonic/gin"
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/attribute"
    "go.opentelemetry.io/otel/codes"
    "go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("go-demo/handlers")

type OrderRequest struct {
    CustomerID    string  `json:"customer_id"`
    Items         []Item  `json:"items"`
    PaymentMethod string  `json:"payment_method"`
}

type Item struct {
    ProductID string  `json:"product_id"`
    Quantity  int     `json:"quantity"`
    Price     float64 `json:"price"`
}

type Order struct {
    ID         string  `json:"id"`
    CustomerID string  `json:"customer_id"`
    Status     string  `json:"status"`
    Total      float64 `json:"total"`
}

func Health(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{"status": "healthy"})
}

func CreateOrder(c *gin.Context) {
    ctx := c.Request.Context()

    // 요청 파싱
    var req OrderRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    // 주문 생성 span
    ctx, span := tracer.Start(ctx, "create-order",
        trace.WithAttributes(
            attribute.String("customer.id", req.CustomerID),
            attribute.Int("order.items_count", len(req.Items)),
            attribute.String("payment.method", req.PaymentMethod),
        ),
    )
    defer span.End()

    // 1. 재고 확인
    if err := checkInventory(ctx, req.Items); err != nil {
        span.RecordError(err)
        span.SetStatus(codes.Error, err.Error())
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    // 2. 결제 처리
    total := calculateTotal(req.Items)
    paymentResult, err := processPayment(ctx, req.CustomerID, total, req.PaymentMethod)
    if err != nil {
        span.RecordError(err)
        span.SetStatus(codes.Error, err.Error())
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    // 3. 주문 저장
    order, err := saveOrder(ctx, req, paymentResult)
    if err != nil {
        span.RecordError(err)
        span.SetStatus(codes.Error, err.Error())
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    span.SetAttributes(attribute.String("order.id", order.ID))
    span.SetStatus(codes.Ok, "Order created successfully")

    c.JSON(http.StatusCreated, order)
}

func GetOrder(c *gin.Context) {
    ctx := c.Request.Context()
    orderID := c.Param("id")

    ctx, span := tracer.Start(ctx, "get-order",
        trace.WithAttributes(attribute.String("order.id", orderID)),
    )
    defer span.End()

    // DB 조회 시뮬레이션
    _, dbSpan := tracer.Start(ctx, "db-query",
        trace.WithAttributes(
            attribute.String("db.system", "postgresql"),
            attribute.String("db.operation", "SELECT"),
            attribute.String("db.statement", "SELECT * FROM orders WHERE id = ?"),
        ),
    )
    time.Sleep(time.Duration(rand.Intn(30)+10) * time.Millisecond)
    dbSpan.End()

    order := Order{
        ID:         orderID,
        CustomerID: "customer-123",
        Status:     "completed",
        Total:      99.99,
    }

    c.JSON(http.StatusOK, order)
}

func GetUser(c *gin.Context) {
    ctx := c.Request.Context()
    userID := c.Param("id")

    _, span := tracer.Start(ctx, "get-user",
        trace.WithAttributes(attribute.String("user.id", userID)),
    )
    defer span.End()

    // DB 조회 시뮬레이션
    time.Sleep(time.Duration(rand.Intn(50)+10) * time.Millisecond)

    c.JSON(http.StatusOK, gin.H{
        "id":    userID,
        "name":  fmt.Sprintf("User %s", userID),
        "email": fmt.Sprintf("user%s@example.com", userID),
    })
}

func checkInventory(ctx context.Context, items []Item) error {
    _, span := tracer.Start(ctx, "check-inventory",
        trace.WithAttributes(attribute.Int("inventory.items_count", len(items))),
    )
    defer span.End()

    time.Sleep(time.Duration(rand.Intn(30)+20) * time.Millisecond)

    span.AddEvent("inventory_checked", trace.WithAttributes(
        attribute.Bool("inventory.available", true),
    ))

    return nil
}

func processPayment(ctx context.Context, customerID string, amount float64, method string) (map[string]interface{}, error) {
    ctx, span := tracer.Start(ctx, "process-payment",
        trace.WithAttributes(
            attribute.String("payment.customer_id", customerID),
            attribute.Float64("payment.amount", amount),
            attribute.String("payment.method", method),
        ),
    )
    defer span.End()

    // 외부 결제 게이트웨이 호출
    _, gatewaySpan := tracer.Start(ctx, "payment-gateway",
        trace.WithAttributes(attribute.String("gateway.provider", "stripe")),
    )
    time.Sleep(time.Duration(rand.Intn(100)+50) * time.Millisecond)

    // 10% 확률로 실패
    if rand.Float32() < 0.1 {
        gatewaySpan.SetStatus(codes.Error, "Payment declined")
        gatewaySpan.End()
        return nil, fmt.Errorf("payment declined")
    }

    transactionID := fmt.Sprintf("txn-%d", time.Now().UnixMilli())
    gatewaySpan.SetAttributes(attribute.String("payment.transaction_id", transactionID))
    gatewaySpan.End()

    span.AddEvent("payment_completed", trace.WithAttributes(
        attribute.String("payment.transaction_id", transactionID),
    ))

    return map[string]interface{}{
        "transaction_id": transactionID,
        "status":         "success",
    }, nil
}

func saveOrder(ctx context.Context, req OrderRequest, payment map[string]interface{}) (*Order, error) {
    _, span := tracer.Start(ctx, "save-order")
    defer span.End()

    // DB INSERT
    _, dbSpan := tracer.Start(ctx, "db-insert",
        trace.WithAttributes(
            attribute.String("db.system", "postgresql"),
            attribute.String("db.operation", "INSERT"),
            attribute.String("db.table", "orders"),
        ),
    )
    time.Sleep(time.Duration(rand.Intn(20)+10) * time.Millisecond)
    dbSpan.End()

    orderID := fmt.Sprintf("order-%d", time.Now().UnixMilli())
    span.SetAttributes(attribute.String("order.id", orderID))

    return &Order{
        ID:         orderID,
        CustomerID: req.CustomerID,
        Status:     "created",
        Total:      calculateTotal(req.Items),
    }, nil
}

func calculateTotal(items []Item) float64 {
    var total float64
    for _, item := range items {
        total += item.Price * float64(item.Quantity)
    }
    return total
}
```

### Dockerfile

```dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o main .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/main .
EXPOSE 8080
CMD ["./main"]
```

## 실행 및 테스트

```bash
# 로컬 실행
export OTEL_SERVICE_NAME=go-demo
export OTEL_EXPORTER_OTLP_ENDPOINT=localhost:4317
go run main.go

# 테스트
curl -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customer_id":"cust-123","items":[{"product_id":"prod-1","quantity":2,"price":29.99}],"payment_method":"credit_card"}'
```
