/**
 * OpenAPI Specification for UR-Live Global Marketplace
 * 
 * This file defines the OpenAPI 3.0 specification for all API endpoints.
 * Auto-generated documentation available at /docs
 */

export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'UR-Live Global Marketplace API',
    version: '1.0.0',
    description: `
# UR-Live API Documentation

Real-time live streaming commerce platform with multi-seller support.

## Features
- 🛒 Multi-seller cart system
- 📺 YouTube Live integration
- 💳 Toss Payments & Stripe integration
- 🌍 7 languages / 12 currencies support
- 🔥 Firebase Authentication
- 📱 Real-time chat & notifications

## Authentication
Most endpoints require Firebase ID token in Authorization header:
\`\`\`
Authorization: Bearer <FIREBASE_ID_TOKEN>
\`\`\`

## Base URL
- Production: https://live.ur-team.com
- Development: http://localhost:8787
    `,
    contact: {
      name: 'UR-Live Team',
      email: 'dev-jobs@ur-team.com',
      url: 'https://github.com/tobe2111/ur-live'
    },
    license: {
      name: 'Proprietary',
      url: 'https://live.ur-team.com/terms'
    }
  },
  servers: [
    {
      url: 'https://live.ur-team.com',
      description: 'Production server'
    },
    {
      url: 'http://localhost:8787',
      description: 'Development server'
    }
  ],
  tags: [
    { name: 'Authentication', description: 'User authentication & authorization' },
    { name: 'Products', description: 'Product catalog management' },
    { name: 'Cart', description: 'Shopping cart operations' },
    { name: 'Orders', description: 'Order management' },
    { name: 'Payments', description: 'Payment processing (Toss, Stripe)' },
    { name: 'Live Streams', description: 'Live streaming & YouTube integration' },
    { name: 'Users', description: 'User profile management' },
    { name: 'Sellers', description: 'Seller management' },
    { name: 'Admin', description: 'Admin operations' },
    { name: 'Wishlists', description: 'Wishlist management' },
    { name: 'Notifications', description: 'Push notifications' },
    { name: 'Banners', description: 'Promotional banners' }
  ],
  components: {
    securitySchemes: {
      FirebaseAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Firebase ID Token obtained after authentication'
      },
      AdminAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Admin JWT token'
      },
      SellerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Seller JWT token'
      }
    },
    schemas: {
      // Common
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' },
          error: { type: 'string' },
          message: { type: 'string' }
        }
      },
      ErrorResponse: {
        type: 'object',
        required: ['success', 'error'],
        properties: {
          success: { type: 'boolean', enum: [false] },
          error: { type: 'string' },
          code: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      },
      
      // User & Auth
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          profile_image: { type: 'string', format: 'uri' },
          user_type: { type: 'string', enum: ['user', 'seller', 'admin'] },
          created_at: { type: 'string', format: 'date-time' }
        }
      },
      
      // Product
      Product: {
        type: 'object',
        required: ['id', 'name', 'price', 'seller_id'],
        properties: {
          id: { type: 'integer' },
          seller_id: { type: 'integer' },
          name: { type: 'string' },
          description: { type: 'string' },
          price: { type: 'number', format: 'float' },
          original_price: { type: 'number', format: 'float' },
          stock: { type: 'integer', minimum: 0 },
          thumbnail_url: { type: 'string', format: 'uri' },
          images: { type: 'array', items: { type: 'string', format: 'uri' } },
          category: { type: 'string' },
          status: { type: 'string', enum: ['active', 'inactive', 'out_of_stock'] },
          created_at: { type: 'string', format: 'date-time' }
        }
      },
      
      // Cart
      CartItem: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          user_id: { type: 'integer' },
          product_id: { type: 'integer' },
          seller_id: { type: 'integer' },
          quantity: { type: 'integer', minimum: 1 },
          price_snapshot: { type: 'number' },
          product: { $ref: '#/components/schemas/Product' }
        }
      },
      
      // Order
      Order: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          order_number: { type: 'string' },
          user_id: { type: 'integer' },
          seller_id: { type: 'integer' },
          status: { 
            type: 'string', 
            enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] 
          },
          total_amount: { type: 'number' },
          shipping_address: { type: 'string' },
          shipping_name: { type: 'string' },
          shipping_phone: { type: 'string' },
          payment_method: { type: 'string' },
          payment_status: { type: 'string', enum: ['pending', 'completed', 'failed'] },
          items: { 
            type: 'array', 
            items: { $ref: '#/components/schemas/OrderItem' } 
          },
          created_at: { type: 'string', format: 'date-time' }
        }
      },
      
      OrderItem: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          order_id: { type: 'integer' },
          product_id: { type: 'integer' },
          quantity: { type: 'integer' },
          price_snapshot: { type: 'number' },
          product_name: { type: 'string' },
          product_thumbnail: { type: 'string', format: 'uri' }
        }
      },
      
      // Live Stream
      LiveStream: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          seller_id: { type: 'integer' },
          title: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string', enum: ['scheduled', 'live', 'ended'] },
          thumbnail_url: { type: 'string', format: 'uri' },
          video_url: { type: 'string', format: 'uri' },
          youtube_video_id: { type: 'string' },
          viewer_count: { type: 'integer', minimum: 0 },
          current_product_id: { type: 'integer' },
          started_at: { type: 'string', format: 'date-time' },
          ended_at: { type: 'string', format: 'date-time' }
        }
      }
    }
  },
  
  paths: {
    // ============================================
    // Authentication
    // ============================================
    '/api/auth/kakao/callback': {
      get: {
        tags: ['Authentication'],
        summary: 'Kakao OAuth callback',
        description: 'Handles Kakao login callback and creates Firebase custom token',
        parameters: [
          {
            name: 'code',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Kakao authorization code'
          }
        ],
        responses: {
          '302': {
            description: 'Redirect to frontend with token',
            headers: {
              Location: {
                schema: { type: 'string' },
                description: 'Redirect URL with firebase_token and userName'
              }
            }
          },
          '500': {
            description: 'Authentication error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        }
      }
    },
    
    '/api/users/init': {
      post: {
        tags: ['Users'],
        summary: 'Initialize user after Firebase auth',
        description: 'Creates or updates user record in database after Firebase authentication',
        security: [{ FirebaseAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['uid', 'email'],
                properties: {
                  uid: { type: 'string', description: 'Firebase UID' },
                  email: { type: 'string', format: 'email' },
                  name: { type: 'string' },
                  profile_image: { type: 'string', format: 'uri' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'User initialized successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/User' }
                      }
                    }
                  ]
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized - Invalid or missing token',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        }
      }
    },
    
    // ============================================
    // Products
    // ============================================
    '/api/products': {
      get: {
        tags: ['Products'],
        summary: 'Get all products',
        description: 'Retrieve paginated list of products with optional filters',
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', minimum: 1, default: 1 }
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
          },
          {
            name: 'category',
            in: 'query',
            schema: { type: 'string' }
          },
          {
            name: 'search',
            in: 'query',
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Products retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', enum: [true] },
                    data: {
                      type: 'object',
                      properties: {
                        products: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Product' }
                        },
                        total: { type: 'integer' },
                        page: { type: 'integer' },
                        pageSize: { type: 'integer' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    
    '/api/products/{id}': {
      get: {
        tags: ['Products'],
        summary: 'Get product by ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          '200': {
            description: 'Product details',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/Product' }
                      }
                    }
                  ]
                }
              }
            }
          },
          '404': {
            description: 'Product not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        }
      }
    },
    
    // ============================================
    // Cart
    // ============================================
    '/api/cart': {
      get: {
        tags: ['Cart'],
        summary: 'Get user cart',
        security: [{ FirebaseAuth: [] }],
        responses: {
          '200': {
            description: 'Cart items retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/CartItem' }
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        }
      },
      post: {
        tags: ['Cart'],
        summary: 'Add item to cart',
        security: [{ FirebaseAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['product_id', 'quantity'],
                properties: {
                  product_id: { type: 'integer' },
                  quantity: { type: 'integer', minimum: 1 },
                  price_snapshot: { type: 'number' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Item added to cart',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiResponse' }
              }
            }
          },
          '400': {
            description: 'Invalid request or insufficient stock',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        }
      }
    },
    
    // ============================================
    // Orders
    // ============================================
    '/api/orders': {
      get: {
        tags: ['Orders'],
        summary: 'Get user orders',
        security: [{ FirebaseAuth: [] }],
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 }
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 20 }
          }
        ],
        responses: {
          '200': {
            description: 'Orders retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Order' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Orders'],
        summary: 'Create new order',
        security: [{ FirebaseAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['items', 'shipping_address', 'shipping_name', 'shipping_phone'],
                properties: {
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        product_id: { type: 'integer' },
                        quantity: { type: 'integer' }
                      }
                    }
                  },
                  shipping_address: { type: 'string' },
                  shipping_name: { type: 'string' },
                  shipping_phone: { type: 'string' },
                  shipping_memo: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Order created',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/Order' }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    
    // ============================================
    // Live Streams
    // ============================================
    '/api/streams': {
      get: {
        tags: ['Live Streams'],
        summary: 'Get all live streams',
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['scheduled', 'live', 'ended'] }
          }
        ],
        responses: {
          '200': {
            description: 'Streams retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/LiveStream' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};
