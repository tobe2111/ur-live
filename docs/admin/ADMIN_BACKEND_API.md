# Admin Dashboard Backend API Documentation

## Overview
Complete backend implementation for the Admin Dashboard with comprehensive endpoints for managing sellers, orders, products, statistics, settlements, and banners.

## Authentication
All admin endpoints require admin authentication via JWT token in the `Authorization` header:
```
Authorization: Bearer <admin_token>
```

## Endpoints

### 🏢 Seller Management

#### GET /api/admin/sellers
Get all sellers.
```typescript
Response: {
  success: true,
  data: Seller[],
  message: string
}
```

#### GET /api/admin/sellers/pending
Get pending sellers awaiting approval.
```typescript
Response: {
  success: true,
  data: Seller[],
  message: string
}
```

#### PATCH /api/admin/sellers/:id/approve
Approve a seller.
```typescript
Response: {
  success: true,
  data: { id: number, status: 'approved' },
  message: string
}
```

#### PATCH /api/admin/sellers/:id/reject
Reject a seller with a reason.
```typescript
Request: {
  reason: string
}

Response: {
  success: true,
  data: { id: number, status: 'rejected' },
  message: string
}
```

#### PATCH /api/admin/sellers/:id/commission
Update seller commission rate (0-100%).
```typescript
Request: {
  commission_rate: number
}

Response: {
  success: true,
  data: { id: number, commission_rate: number },
  message: string
}
```

#### PATCH /api/admin/sellers/:id/permissions
Toggle seller special permissions (stats manipulation, fake notifications).
```typescript
Request: {
  can_manipulate_stats: 0 | 1
}

Response: {
  success: true,
  data: { id: number, can_manipulate_stats: number },
  message: string
}
```

### 📦 Order Management

#### GET /api/admin/orders
Get all orders with optional filters.
```typescript
Query Parameters:
- status?: string (pending, confirmed, shipped, delivered, cancelled)
- seller_id?: number
- start_date?: string (YYYY-MM-DD)
- end_date?: string (YYYY-MM-DD)

Response: {
  success: true,
  data: Order[], // includes order items
  message: string
}
```

### 🏷️ Product Management

#### GET /api/admin/products
Get all products from all sellers.
```typescript
Response: {
  success: true,
  data: Product[],
  message: string
}
```

### 📊 Statistics

#### GET /api/admin/stats
Get dashboard statistics.
```typescript
Response: {
  success: true,
  data: {
    totalSellers: number,
    activeSellers: number,
    totalStreams: number,
    activeStreams: number
  },
  message: string
}
```

#### GET /api/admin/dashboard/stats
Get real-time dashboard statistics.
```typescript
Response: {
  success: true,
  data: {
    stats: {
      todaySales: number,
      todayOrders: number,
      currentVisitors: number,
      liveStreams: number
    }
  },
  message: string
}
```

### 💰 Settlement Management

#### GET /api/admin/settlement/stats
Get settlement statistics.
```typescript
Query Parameters:
- period?: string (all, today, week, month)

Response: {
  success: true,
  data: {
    overview: {
      total_orders: number,
      total_sales: number,
      total_commission: number,
      total_seller_amount: number
    },
    sellers: SellerSettlement[]
  },
  message: string
}
```

#### GET /api/admin/settlement/records
Get settlement records.
```typescript
Query Parameters:
- period?: string (all, today, week, month)
- seller_id?: number
- status?: string (pending, settled, cancelled)

Response: {
  success: true,
  data: SettlementRecord[],
  message: string
}
```

### 🎨 Banner Management

#### GET /api/admin/banners
Get all banners.
```typescript
Response: {
  success: true,
  data: Banner[],
  message: string
}
```

#### POST /api/admin/banners
Create a new banner.
```typescript
Request: {
  title: string,
  image_url: string,
  link_url?: string,
  description?: string,
  is_active?: boolean,
  display_order?: number,
  start_date?: string,
  end_date?: string
}

Response: {
  success: true,
  data: { id: number, title: string },
  message: string
}
```

#### PUT /api/admin/banners/:id
Update a banner.
```typescript
Request: Same as POST

Response: {
  success: true,
  data: { id: number },
  message: string
}
```

#### DELETE /api/admin/banners/:id
Delete a banner.
```typescript
Response: {
  success: true,
  data: { id: number },
  message: string
}
```

### 📺 Stream Management

#### DELETE /api/admin/streams/:id
Delete a live stream.
```typescript
Response: {
  success: true,
  data: { id: number },
  message: string
}
```

## Database Schema Updates

Run the migration script to add necessary fields:
```bash
npx wrangler d1 execute <database-name> --remote --file=./migrations/0010_admin_dashboard_backend.sql
```

### Added/Updated Tables:
1. **banners** - Added `image_url`, `link_url`, `description` columns
2. **orders** - Added `settlement_status`, `settled_at`, `seller_id`, `order_number`, `payment_status`, shipping fields
3. **sellers** - Added `can_manipulate_stats`, `company_name` columns
4. **order_items** - New table for order line items
5. **products** - Added `product_type`, `is_active` columns

### Indexes Added:
- `idx_orders_settlement_status`
- `idx_orders_seller_id`
- `idx_orders_created_at`
- `idx_sellers_status`
- `idx_banners_display_order`
- `idx_banners_is_active`

## Implementation Status

| Feature | Frontend | Backend | Status |
|---------|----------|---------|--------|
| Seller Management | ✅ 100% | ✅ 100% | Complete |
| Order Management | ✅ 100% | ✅ 100% | Complete |
| Product Management | ✅ 100% | ✅ 100% | Complete |
| Statistics | ✅ 100% | ✅ 100% | Complete |
| Settlement | ✅ 100% | ✅ 100% | Complete |
| Banners | ✅ 100% | ✅ 100% | Complete |
| Streams | ✅ 100% | ✅ 100% | Complete |

## API Architecture

```
src/features/admin/
├── api/
│   ├── admin-management.routes.ts  # Sellers, orders, products, stats, settlements
│   ├── admin-banners.routes.ts     # Banner management
│   └── index.ts                    # Exports
└── index.ts

src/worker/index.ts                 # Registers routes
```

## Error Handling

All endpoints follow consistent error responses:
```typescript
{
  success: false,
  error: {
    code: string,
    message: string
  }
}
```

Common error codes:
- `VALIDATION_ERROR` (400) - Missing or invalid request data
- `UNAUTHORIZED` (401) - Invalid or missing authentication
- `NOT_FOUND` (404) - Resource not found
- `INTERNAL_ERROR` (500) - Server error

## Next Steps

1. ✅ Run database migration
2. ✅ Test all endpoints
3. ✅ Deploy to production
4. ✅ Monitor logs for errors
5. Add email notifications for seller approval/rejection
6. Implement real-time visitor tracking
7. Add export functionality (CSV/Excel)

## Notes

- All timestamps are in UTC
- Commission rates are percentages (0-100)
- Settlement amounts are calculated automatically
- Seller permissions default to 0 (disabled)
- Banners support date ranges for scheduling

## Support

For issues or questions, contact the development team or check the project documentation.
