---
sidebar_position: 5
title: Python 예제
description: Python/FastAPI 애플리케이션의 상세한 OpenTelemetry 계측 예제
---

# Python 예제

## 프로젝트 설정

```bash
mkdir python-otel-demo && cd python-otel-demo
python -m venv venv
source venv/bin/activate
```

### 의존성 설치

```bash
pip install fastapi uvicorn httpx

# OpenTelemetry 패키지
pip install opentelemetry-api \
            opentelemetry-sdk \
            opentelemetry-exporter-otlp \
            opentelemetry-instrumentation-fastapi \
            opentelemetry-instrumentation-httpx \
            opentelemetry-instrumentation-sqlalchemy
```

## 프로젝트 구조

```
python-otel-demo/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── tracing.py
│   ├── routes/
│   │   ├── __init__.py
│   │   └── orders.py
│   └── services/
│       ├── __init__.py
│       └── order_service.py
├── requirements.txt
└── Dockerfile
```

## 코드

### 트레이싱 설정

```python
# app/tracing.py
import os
from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor


def setup_telemetry(app):
    """OpenTelemetry 설정"""

    # 리소스 정의
    resource = Resource.create({
        SERVICE_NAME: os.getenv("OTEL_SERVICE_NAME", "python-demo"),
        SERVICE_VERSION: "1.0.0",
        "deployment.environment": os.getenv("ENVIRONMENT", "development"),
    })

    # OTLP 엔드포인트
    otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317")

    # Trace Provider 설정
    trace_provider = TracerProvider(resource=resource)
    trace_provider.add_span_processor(
        BatchSpanProcessor(
            OTLPSpanExporter(endpoint=otlp_endpoint, insecure=True)
        )
    )
    trace.set_tracer_provider(trace_provider)

    # Metrics Provider 설정
    metric_reader = PeriodicExportingMetricReader(
        OTLPMetricExporter(endpoint=otlp_endpoint, insecure=True),
        export_interval_millis=10000,
    )
    meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
    metrics.set_meter_provider(meter_provider)

    # 자동 계측
    FastAPIInstrumentor.instrument_app(app)
    HTTPXClientInstrumentor().instrument()

    return trace.get_tracer(__name__), metrics.get_meter(__name__)
```

### 메인 애플리케이션

```python
# app/main.py
from fastapi import FastAPI, HTTPException
from contextlib import asynccontextmanager
from app.tracing import setup_telemetry
from app.routes import orders

tracer = None
meter = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global tracer, meter
    tracer, meter = setup_telemetry(app)
    yield


app = FastAPI(title="Python OTel Demo", lifespan=lifespan)

# 라우터 등록
app.include_router(orders.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/")
async def root():
    return {"message": "Python OTel Demo"}
```

### 주문 라우트

```python
# app/routes/orders.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from opentelemetry import trace
from app.services.order_service import OrderService

router = APIRouter(tags=["orders"])
tracer = trace.get_tracer(__name__)


class OrderItem(BaseModel):
    product_id: str
    quantity: int
    price: float


class OrderRequest(BaseModel):
    customer_id: str
    items: List[OrderItem]
    payment_method: Optional[str] = "credit_card"


class Order(BaseModel):
    id: str
    customer_id: str
    status: str
    total: float


@router.post("/orders", response_model=Order)
async def create_order(request: OrderRequest):
    """주문 생성"""
    with tracer.start_as_current_span("api.create_order") as span:
        span.set_attribute("customer.id", request.customer_id)
        span.set_attribute("order.items_count", len(request.items))
        span.set_attribute("payment.method", request.payment_method)

        try:
            service = OrderService()
            order = await service.create_order(request)
            span.set_attribute("order.id", order.id)
            return order
        except Exception as e:
            span.record_exception(e)
            raise HTTPException(status_code=500, detail=str(e))


@router.get("/orders/{order_id}", response_model=Order)
async def get_order(order_id: str):
    """주문 조회"""
    with tracer.start_as_current_span("api.get_order") as span:
        span.set_attribute("order.id", order_id)

        service = OrderService()
        order = await service.get_order(order_id)

        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        return order
```

### 주문 서비스

```python
# app/services/order_service.py
import asyncio
import random
import time
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode

tracer = trace.get_tracer(__name__)


class OrderService:
    async def create_order(self, request):
        """주문 생성 비즈니스 로직"""

        with tracer.start_as_current_span("service.create_order") as span:
            # 1. 재고 확인
            await self._check_inventory(request.items)

            # 2. 결제 처리
            payment_result = await self._process_payment(
                request.customer_id,
                self._calculate_total(request.items),
                request.payment_method
            )

            # 3. 주문 저장
            order = await self._save_order(request, payment_result)

            span.add_event("order_created", {
                "order.id": order.id,
                "order.total": order.total
            })

            return order

    async def get_order(self, order_id: str):
        """주문 조회"""
        with tracer.start_as_current_span("service.get_order") as span:
            span.set_attribute("order.id", order_id)

            # DB 조회 시뮬레이션
            with tracer.start_as_current_span("db.select") as db_span:
                db_span.set_attribute("db.system", "postgresql")
                db_span.set_attribute("db.operation", "SELECT")
                db_span.set_attribute("db.statement", "SELECT * FROM orders WHERE id = ?")
                await asyncio.sleep(0.02)

            return Order(
                id=order_id,
                customer_id="customer-123",
                status="completed",
                total=99.99
            )

    async def _check_inventory(self, items):
        """재고 확인"""
        with tracer.start_as_current_span("service.check_inventory") as span:
            span.set_attribute("inventory.items_count", len(items))

            # 외부 재고 서비스 호출 시뮬레이션
            await asyncio.sleep(random.uniform(0.02, 0.05))

            span.add_event("inventory_checked", {
                "inventory.available": True
            })

    async def _process_payment(self, customer_id: str, amount: float, method: str):
        """결제 처리"""
        with tracer.start_as_current_span("service.process_payment") as span:
            span.set_attribute("payment.customer_id", customer_id)
            span.set_attribute("payment.amount", amount)
            span.set_attribute("payment.method", method)

            # 결제 게이트웨이 호출 시뮬레이션
            with tracer.start_as_current_span("external.payment_gateway") as gateway_span:
                gateway_span.set_attribute("gateway.provider", "stripe")
                await asyncio.sleep(random.uniform(0.1, 0.2))

                # 10% 확률로 결제 실패
                if random.random() < 0.1:
                    gateway_span.set_status(Status(StatusCode.ERROR))
                    raise Exception("Payment failed")

                transaction_id = f"txn-{int(time.time() * 1000)}"
                gateway_span.set_attribute("payment.transaction_id", transaction_id)

            span.add_event("payment_completed", {
                "payment.transaction_id": transaction_id
            })

            return {"transaction_id": transaction_id, "status": "success"}

    async def _save_order(self, request, payment_result):
        """주문 저장"""
        with tracer.start_as_current_span("service.save_order") as span:
            # DB INSERT 시뮬레이션
            with tracer.start_as_current_span("db.insert") as db_span:
                db_span.set_attribute("db.system", "postgresql")
                db_span.set_attribute("db.operation", "INSERT")
                db_span.set_attribute("db.table", "orders")
                await asyncio.sleep(random.uniform(0.01, 0.03))

            order_id = f"order-{int(time.time() * 1000)}"
            span.set_attribute("order.id", order_id)

            return Order(
                id=order_id,
                customer_id=request.customer_id,
                status="created",
                total=self._calculate_total(request.items)
            )

    def _calculate_total(self, items) -> float:
        return sum(item.price * item.quantity for item in items)


class Order:
    def __init__(self, id: str, customer_id: str, status: str, total: float):
        self.id = id
        self.customer_id = customer_id
        self.status = status
        self.total = total
```

### requirements.txt

```txt
fastapi==0.109.0
uvicorn==0.25.0
httpx==0.26.0
pydantic==2.5.3

opentelemetry-api==1.22.0
opentelemetry-sdk==1.22.0
opentelemetry-exporter-otlp-proto-grpc==1.22.0
opentelemetry-instrumentation-fastapi==0.43b0
opentelemetry-instrumentation-httpx==0.43b0
opentelemetry-instrumentation-sqlalchemy==0.43b0
```

### Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 실행

```bash
# 로컬 실행
export OTEL_SERVICE_NAME=python-demo
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317

uvicorn app.main:app --reload

# Docker 실행
docker build -t python-otel-demo .
docker run -p 8000:8000 \
  -e OTEL_SERVICE_NAME=python-demo \
  -e OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4317 \
  python-otel-demo
```

## 테스트

```bash
# 주문 생성
curl -X POST http://localhost:8000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "cust-123",
    "items": [
      {"product_id": "prod-1", "quantity": 2, "price": 29.99}
    ],
    "payment_method": "credit_card"
  }'

# 주문 조회
curl http://localhost:8000/api/orders/order-123
```

## 다음 단계

- [Go 예제](./go-example) - Go 상세 계측
