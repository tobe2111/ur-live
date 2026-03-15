import { sqliteTable, text, integer, } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
/**
 * ✅ Drizzle ORM Schema 정의
 *
 * Week 5 Day 3 - DB 타입 안전성 & N+1 쿼리 해결
 *
 * 목적:
 * - 타입 안전한 DB 쿼리
 * - N+1 쿼리 자동 해결 (relations)
 * - SQL Injection 방지
 */
// ============================================
// 사용자 테이블
// ============================================
export const users = sqliteTable('users', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tossUserId: text('toss_user_id').notNull().unique(),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    createdAt: text('created_at').default(sql `CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').default(sql `CURRENT_TIMESTAMP`),
});
// ============================================
// 라이브 스트림 테이블
// ============================================
export const liveStreams = sqliteTable('live_streams', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    description: text('description'),
    youtubeVideoId: text('youtube_video_id').notNull(),
    status: text('status', { enum: ['scheduled', 'live', 'ended'] }).default('scheduled'),
    currentProductId: integer('current_product_id'),
    createdAt: text('created_at').default(sql `CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').default(sql `CURRENT_TIMESTAMP`),
});
// ============================================
// 상품 테이블
// ============================================
export const products = sqliteTable('products', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    description: text('description'),
    price: integer('price').notNull(),
    originalPrice: integer('original_price'),
    discountRate: integer('discount_rate').default(0),
    imageUrl: text('image_url'),
    stock: integer('stock').default(0),
    category: text('category'),
    liveStreamId: integer('live_stream_id'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    createdAt: text('created_at').default(sql `CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').default(sql `CURRENT_TIMESTAMP`),
});
// ============================================
// 상품 옵션 테이블
// ============================================
export const productOptions = sqliteTable('product_options', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productId: integer('product_id').notNull(),
    optionType: text('option_type').notNull(),
    optionValue: text('option_value').notNull(),
    priceAdjustment: integer('price_adjustment').default(0),
    stock: integer('stock').default(0),
    createdAt: text('created_at').default(sql `CURRENT_TIMESTAMP`),
});
// ============================================
// 장바구니 테이블
// ============================================
export const cartItems = sqliteTable('cart_items', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull(),
    productId: integer('product_id').notNull(),
    optionId: integer('option_id'),
    quantity: integer('quantity').default(1),
    priceSnapshot: integer('price_snapshot').notNull(),
    liveStreamId: integer('live_stream_id'),
    addedAt: text('added_at').default(sql `CURRENT_TIMESTAMP`),
});
// ============================================
// 주문 테이블
// ============================================
export const orders = sqliteTable('orders', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    orderNumber: text('order_number').notNull().unique(),
    userId: integer('user_id').notNull(),
    totalAmount: integer('total_amount').notNull(),
    paymentKey: text('payment_key'),
    paymentStatus: text('payment_status', {
        enum: ['pending', 'approved', 'failed', 'cancelled', 'refunded']
    }).default('pending'),
    shippingAddress: text('shipping_address'),
    shippingName: text('shipping_name'),
    shippingPhone: text('shipping_phone'),
    liveStreamId: integer('live_stream_id'),
    createdAt: text('created_at').default(sql `CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').default(sql `CURRENT_TIMESTAMP`),
});
// ============================================
// 주문 상품 테이블
// ============================================
export const orderItems = sqliteTable('order_items', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    orderId: integer('order_id').notNull(),
    productId: integer('product_id').notNull(),
    optionId: integer('option_id'),
    quantity: integer('quantity').notNull(),
    price: integer('price').notNull(),
    productName: text('product_name').notNull(),
    optionInfo: text('option_info'),
});
// ============================================
// Relations (N+1 해결)
// ============================================
// 사용자 → 주문 (1:N)
export const usersRelations = relations(users, ({ many }) => ({
    orders: many(orders),
    cartItems: many(cartItems),
}));
// 주문 → 사용자 (N:1)
// 주문 → 주문 상품 (1:N)
export const ordersRelations = relations(orders, ({ one, many }) => ({
    user: one(users, {
        fields: [orders.userId],
        references: [users.id],
    }),
    items: many(orderItems),
    liveStream: one(liveStreams, {
        fields: [orders.liveStreamId],
        references: [liveStreams.id],
    }),
}));
// 주문 상품 → 주문 (N:1)
// 주문 상품 → 상품 (N:1)
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
    order: one(orders, {
        fields: [orderItems.orderId],
        references: [orders.id],
    }),
    product: one(products, {
        fields: [orderItems.productId],
        references: [products.id],
    }),
    option: one(productOptions, {
        fields: [orderItems.optionId],
        references: [productOptions.id],
    }),
}));
// 상품 → 옵션 (1:N)
// 상품 → 라이브 스트림 (N:1)
export const productsRelations = relations(products, ({ one, many }) => ({
    options: many(productOptions),
    liveStream: one(liveStreams, {
        fields: [products.liveStreamId],
        references: [liveStreams.id],
    }),
}));
// 상품 옵션 → 상품 (N:1)
export const productOptionsRelations = relations(productOptions, ({ one }) => ({
    product: one(products, {
        fields: [productOptions.productId],
        references: [products.id],
    }),
}));
// 라이브 스트림 → 상품 (1:N)
export const liveStreamsRelations = relations(liveStreams, ({ many }) => ({
    products: many(products),
    orders: many(orders),
}));
// 장바구니 → 사용자 (N:1)
// 장바구니 → 상품 (N:1)
export const cartItemsRelations = relations(cartItems, ({ one }) => ({
    user: one(users, {
        fields: [cartItems.userId],
        references: [users.id],
    }),
    product: one(products, {
        fields: [cartItems.productId],
        references: [products.id],
    }),
    option: one(productOptions, {
        fields: [cartItems.optionId],
        references: [productOptions.id],
    }),
    liveStream: one(liveStreams, {
        fields: [cartItems.liveStreamId],
        references: [liveStreams.id],
    }),
}));
