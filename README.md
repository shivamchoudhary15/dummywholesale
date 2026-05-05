# Wholesale / Bulk Order Management System

Spring Boot hackathon demo for a B2B wholesale ordering platform.

## Features

- Retailer registration and seller approval workflow
- Tiered pricing calculated by quantity
- MOQ, stock, buyer approval, and credit-limit validation
- Credit / Net 30 and pay-now checkout paths
- CSV quick-order upload with `sku,quantity`
- Reorder flow for recurring buyers
- Invoice generation with GST and shipping breakdown
- Seller admin controls for MOQ, stock, tier prices, and credit terms

## Run

```bash
mvn spring-boot:run
```

Then open:

```text
http://localhost:8080
```

The sample upload file is available at `src/main/resources/static/quick-order.csv`.

## API Surface

- `GET /api/state`
- `POST /api/register`
- `POST /api/approve`
- `POST /api/credit`
- `POST /api/cart/quantity`
- `POST /api/cart/reorder`
- `POST /api/cart/upload`
- `PUT /api/products`
- `POST /api/rfq`
- `POST /api/checkout`
