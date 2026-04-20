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
    { name: 'Banners', description: 'Promotional banners' },
    { name: 'Referral', description: 'Friend referral group-buy & multi-level referral tree' },
    { name: 'Loyalty', description: 'VIP tier / loyalty program' },
    { name: 'Group Buy', description: 'Community group buy & voucher system' },
    { name: 'Image', description: 'Image optimization & proxy' }
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
      },

      // Referral
      Referral: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          code: { type: 'string', description: 'Unique referral invite code' },
          product_id: { type: 'integer' },
          creator_id: { type: 'integer' },
          discount_percent: { type: 'number' },
          max_uses: { type: 'integer' },
          current_uses: { type: 'integer' },
          expires_at: { type: 'string', format: 'date-time' },
          created_at: { type: 'string', format: 'date-time' }
        }
      },

      // Referral Tree Node
      ReferralTreeNode: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          user_id: { type: 'integer' },
          parent_id: { type: 'integer', nullable: true },
          referral_code: { type: 'string' },
          depth: { type: 'integer' },
          children: { type: 'array', items: { $ref: '#/components/schemas/ReferralTreeNode' } }
        }
      },

      // Referral Commission
      ReferralCommission: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          user_id: { type: 'integer' },
          order_id: { type: 'integer' },
          amount: { type: 'number' },
          level: { type: 'integer', description: 'Commission depth level (1 = direct, 2 = indirect, etc.)' },
          status: { type: 'string', enum: ['pending', 'paid', 'cancelled'] },
          created_at: { type: 'string', format: 'date-time' }
        }
      },

      // Loyalty Tier
      LoyaltyTier: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string', description: 'Tier name (e.g. Bronze, Silver, Gold, VIP)' },
          min_spent: { type: 'number', description: 'Minimum total spending to qualify' },
          discount_percent: { type: 'number' },
          benefits: { type: 'string', description: 'JSON or text description of benefits' }
        }
      },

      // User Loyalty Info
      UserLoyalty: {
        type: 'object',
        properties: {
          user_id: { type: 'integer' },
          tier: { $ref: '#/components/schemas/LoyaltyTier' },
          total_spent: { type: 'number' },
          total_orders: { type: 'integer' },
          next_tier: { $ref: '#/components/schemas/LoyaltyTier' },
          amount_to_next: { type: 'number', description: 'Amount needed to reach next tier' }
        }
      },

      // Group Buy Product
      GroupBuyProduct: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          product_id: { type: 'integer' },
          title: { type: 'string' },
          original_price: { type: 'number' },
          group_price: { type: 'number' },
          min_participants: { type: 'integer' },
          max_participants: { type: 'integer' },
          current_participants: { type: 'integer' },
          status: { type: 'string', enum: ['active', 'completed', 'expired', 'cancelled'] },
          expires_at: { type: 'string', format: 'date-time' },
          created_at: { type: 'string', format: 'date-time' }
        }
      },

      // Voucher
      Voucher: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          code: { type: 'string' },
          product_id: { type: 'integer' },
          user_id: { type: 'integer' },
          is_used: { type: 'boolean' },
          used_at: { type: 'string', format: 'date-time', nullable: true },
          created_at: { type: 'string', format: 'date-time' }
        }
      },

      // Pagination meta
      Pagination: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
          totalPages: { type: 'integer' }
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
    },

    // ============================================
    // Auth — Login & Register
    // ============================================
    '/api/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new user',
        description: 'Create a new user account with email and password. Rate limited to 5 attempts per hour.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'name'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  name: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'User registered successfully',
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
          '400': {
            description: 'Validation error or email already exists',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          },
          '429': {
            description: 'Rate limit exceeded',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          }
        }
      }
    },

    '/api/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Login with email and password',
        description: 'Authenticate and receive a session token. Rate limited to 10 attempts per 5 minutes.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', enum: [true] },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/User' },
                        token: { type: 'string', description: 'JWT session token' }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Invalid credentials',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          },
          '429': {
            description: 'Rate limit exceeded',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          }
        }
      }
    },

    '/api/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current user info',
        description: 'Returns the currently authenticated user based on Bearer token or session cookie.',
        security: [{ FirebaseAuth: [] }],
        responses: {
          '200': {
            description: 'Current user',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    { type: 'object', properties: { data: { $ref: '#/components/schemas/User' } } }
                  ]
                }
              }
            }
          },
          '401': {
            description: 'Not authenticated',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          }
        }
      }
    },

    // ============================================
    // Products — Create
    // ============================================
    '/api/products (POST)': {
      post: {
        tags: ['Products'],
        summary: 'Create a new product',
        description: 'Seller creates a product listing. Requires authentication.',
        security: [{ FirebaseAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'price'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  price: { type: 'number', minimum: 0 },
                  original_price: { type: 'number', minimum: 0 },
                  stock: { type: 'integer', minimum: 0 },
                  category: { type: 'string' },
                  thumbnail_url: { type: 'string', format: 'uri' },
                  images: { type: 'array', items: { type: 'string', format: 'uri' } }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Product created',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    { type: 'object', properties: { data: { $ref: '#/components/schemas/Product' } } }
                  ]
                }
              }
            }
          },
          '400': {
            description: 'Validation error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          },
          '401': {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          }
        }
      }
    },

    // ============================================
    // Orders — Status Update & Cancel
    // ============================================
    '/api/orders/{id}/cancel': {
      post: {
        tags: ['Orders'],
        summary: 'Cancel an order',
        description: 'Request cancellation of an order. Only allowed for pending/confirmed orders.',
        security: [{ FirebaseAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '200': {
            description: 'Order cancelled',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } }
          },
          '400': {
            description: 'Order cannot be cancelled in current status',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          },
          '404': {
            description: 'Order not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          }
        }
      }
    },

    '/api/orders/{id}/confirm': {
      post: {
        tags: ['Orders'],
        summary: 'Confirm delivery of an order',
        description: 'User confirms they have received the order, triggering seller settlement.',
        security: [{ FirebaseAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '200': {
            description: 'Order confirmed',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } }
          },
          '400': {
            description: 'Order cannot be confirmed in current status',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          }
        }
      }
    },

    '/api/orders/{id}/tracking': {
      get: {
        tags: ['Orders'],
        summary: 'Get order tracking info',
        description: 'Retrieve shipping/tracking information for a specific order.',
        security: [{ FirebaseAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '200': {
            description: 'Tracking info',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        carrier: { type: 'string' },
                        tracking_number: { type: 'string' },
                        status: { type: 'string' },
                        events: { type: 'array', items: { type: 'object' } }
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

    // ============================================
    // Referral — Friend invite group-buy
    // ============================================
    '/api/referral/create': {
      post: {
        tags: ['Referral'],
        summary: 'Create a referral invite link',
        description: 'Generate a unique referral code for a product to share with friends for group discount.',
        security: [{ FirebaseAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['product_id'],
                properties: {
                  product_id: { type: 'integer' },
                  discount_percent: { type: 'number', minimum: 0, maximum: 100 },
                  max_uses: { type: 'integer', minimum: 1 }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Referral created',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    { type: 'object', properties: { data: { $ref: '#/components/schemas/Referral' } } }
                  ]
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          }
        }
      }
    },

    '/api/referral/join/{code}': {
      post: {
        tags: ['Referral'],
        summary: 'Join a referral group-buy',
        description: 'Use a referral code to join a friend\'s group-buy and receive a discount.',
        security: [{ FirebaseAuth: [] }],
        parameters: [
          { name: 'code', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Successfully joined referral',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } }
          },
          '400': {
            description: 'Code expired, max uses reached, or already joined',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          },
          '404': {
            description: 'Referral code not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          }
        }
      }
    },

    '/api/referral/my': {
      get: {
        tags: ['Referral'],
        summary: 'Get my referral invites',
        description: 'List all referral codes created by the current user.',
        security: [{ FirebaseAuth: [] }],
        responses: {
          '200': {
            description: 'My referrals',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/Referral' } }
                  }
                }
              }
            }
          }
        }
      }
    },

    '/api/referral/{code}': {
      get: {
        tags: ['Referral'],
        summary: 'Get referral details by code',
        description: 'Retrieve information about a specific referral invite, including product and discount.',
        parameters: [
          { name: 'code', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Referral details',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    { type: 'object', properties: { data: { $ref: '#/components/schemas/Referral' } } }
                  ]
                }
              }
            }
          },
          '404': {
            description: 'Referral not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          }
        }
      }
    },

    // ============================================
    // Referral Tree — Multi-level commissions
    // ============================================
    '/api/referral-tree/register': {
      post: {
        tags: ['Referral'],
        summary: 'Register in the referral tree',
        description: 'Register a user under a parent referrer in the multi-level referral tree.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['user_id', 'referral_code'],
                properties: {
                  user_id: { type: 'integer' },
                  referral_code: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Registered in referral tree',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } }
          }
        }
      }
    },

    '/api/referral-tree/my-network': {
      get: {
        tags: ['Referral'],
        summary: 'Get my referral network',
        description: 'Retrieve the user\'s referral tree with direct and indirect referrals.',
        security: [{ FirebaseAuth: [] }],
        responses: {
          '200': {
            description: 'Referral network tree',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        tree: { $ref: '#/components/schemas/ReferralTreeNode' },
                        total_referrals: { type: 'integer' },
                        total_earnings: { type: 'number' }
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

    '/api/referral-tree/my-commissions': {
      get: {
        tags: ['Referral'],
        summary: 'Get my referral commissions',
        description: 'List all commission earnings from the multi-level referral tree.',
        security: [{ FirebaseAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
        ],
        responses: {
          '200': {
            description: 'Commission list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/ReferralCommission' } }
                  }
                }
              }
            }
          }
        }
      }
    },

    // ============================================
    // Loyalty — VIP tiers
    // ============================================
    '/api/loyalty/tiers': {
      get: {
        tags: ['Loyalty'],
        summary: 'Get all loyalty tiers',
        description: 'Retrieve the list of available VIP loyalty tiers and their requirements.',
        responses: {
          '200': {
            description: 'Loyalty tiers',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/LoyaltyTier' } }
                  }
                }
              }
            }
          }
        }
      }
    },

    '/api/loyalty/my-tier': {
      get: {
        tags: ['Loyalty'],
        summary: 'Get my current loyalty tier',
        description: 'Returns the authenticated user\'s current VIP tier, total spending, and progress to next tier.',
        security: [{ FirebaseAuth: [] }],
        responses: {
          '200': {
            description: 'User loyalty info',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    { type: 'object', properties: { data: { $ref: '#/components/schemas/UserLoyalty' } } }
                  ]
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          }
        }
      }
    },

    '/api/loyalty/recalculate': {
      post: {
        tags: ['Loyalty'],
        summary: 'Recalculate my loyalty tier',
        description: 'Force recalculation of the user\'s loyalty tier based on current spending totals.',
        security: [{ FirebaseAuth: [] }],
        responses: {
          '200': {
            description: 'Tier recalculated',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    { type: 'object', properties: { data: { $ref: '#/components/schemas/UserLoyalty' } } }
                  ]
                }
              }
            }
          }
        }
      }
    },

    // ============================================
    // Group Buy — Community group purchasing
    // ============================================
    '/api/group-buy/products': {
      get: {
        tags: ['Group Buy'],
        summary: 'List active group-buy products',
        description: 'Retrieve products available for community group-buy with current participant counts.',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
        ],
        responses: {
          '200': {
            description: 'Group-buy product list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/GroupBuyProduct' } }
                  }
                }
              }
            }
          }
        }
      }
    },

    '/api/group-buy/products/{id}': {
      get: {
        tags: ['Group Buy'],
        summary: 'Get group-buy product detail',
        description: 'Retrieve details of a specific group-buy product including participant info.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '200': {
            description: 'Group-buy product detail',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    { type: 'object', properties: { data: { $ref: '#/components/schemas/GroupBuyProduct' } } }
                  ]
                }
              }
            }
          },
          '404': {
            description: 'Not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          }
        }
      }
    },

    '/api/group-buy/join/{id}': {
      post: {
        tags: ['Group Buy'],
        summary: 'Join a group-buy',
        description: 'Participate in a community group-buy. Payment is processed and a voucher is issued.',
        security: [{ FirebaseAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Group-buy product ID' }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  quantity: { type: 'integer', minimum: 1, default: 1 }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Joined group-buy, voucher issued',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        voucher: { $ref: '#/components/schemas/Voucher' },
                        group_buy: { $ref: '#/components/schemas/GroupBuyProduct' }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Group-buy expired, full, or insufficient balance',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          },
          '401': {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          }
        }
      }
    },

    '/api/group-buy/my': {
      get: {
        tags: ['Group Buy'],
        summary: 'Get my group-buy participations',
        description: 'List all group-buys the current user has joined, with voucher status.',
        security: [{ FirebaseAuth: [] }],
        responses: {
          '200': {
            description: 'My group-buy list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/GroupBuyProduct' } }
                  }
                }
              }
            }
          }
        }
      }
    },

    '/api/group-buy/verify/{code}': {
      get: {
        tags: ['Group Buy'],
        summary: 'Verify a voucher code',
        description: 'Check if a voucher code is valid and unused. Used by sellers to verify at point of sale.',
        parameters: [
          { name: 'code', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Voucher verification result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        valid: { type: 'boolean' },
                        voucher: { $ref: '#/components/schemas/Voucher' }
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

    // ============================================
    // Image Optimization
    // ============================================
    '/api/image/resize': {
      get: {
        tags: ['Image'],
        summary: 'Resize and optimize an image',
        description: 'Proxy an image through Cloudflare Image Resizing for WebP conversion, resizing, and quality optimization. Falls back to proxied original with cache headers if resizing is unavailable.',
        parameters: [
          {
            name: 'url',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'uri' },
            description: 'Source image URL to resize'
          },
          {
            name: 'w',
            in: 'query',
            schema: { type: 'integer', default: 400, minimum: 1, maximum: 4096 },
            description: 'Target width in pixels'
          },
          {
            name: 'q',
            in: 'query',
            schema: { type: 'integer', default: 80, minimum: 1, maximum: 100 },
            description: 'Quality (1-100)'
          }
        ],
        responses: {
          '200': {
            description: 'Optimized image binary',
            content: {
              'image/webp': { schema: { type: 'string', format: 'binary' } }
            }
          },
          '302': { description: 'Redirect to original image (fallback)' },
          '400': {
            description: 'Missing url parameter',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          }
        }
      }
    }
  }
};
