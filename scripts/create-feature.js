#!/usr/bin/env node

/**
 * Feature 생성 스크립트
 * 
 * Usage:
 *   npm run create-feature <feature-name>
 *   npm run create-feature payment-jp
 *   npm run create-feature auth-google
 */

const fs = require('fs')
const path = require('path')

const featureName = process.argv[2]

if (!featureName) {
  console.error('❌ Error: Feature name is required')
  console.log('Usage: npm run create-feature <feature-name>')
  console.log('Example: npm run create-feature payment-jp')
  process.exit(1)
}

// Convert kebab-case to PascalCase
function toPascalCase(str) {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}

const featureDir = path.join(__dirname, '..', 'src', 'features', featureName)
const pascalName = toPascalCase(featureName)

// Check if feature already exists
if (fs.existsSync(featureDir)) {
  console.error(`❌ Error: Feature '${featureName}' already exists`)
  process.exit(1)
}

console.log(`🚀 Creating feature: ${featureName}`)
console.log(`📂 Location: src/features/${featureName}/`)
console.log('')

// Create directory structure
const directories = [
  '',
  'api',
  'stores',
  'components',
  'services',
  'types',
  '__tests__'
]

directories.forEach(dir => {
  const dirPath = path.join(featureDir, dir)
  fs.mkdirSync(dirPath, { recursive: true })
  console.log(`✅ Created ${path.relative(process.cwd(), dirPath)}/`)
})

// Templates

// 1. API Route
const apiRouteTemplate = `/**
 * ${pascalName} API Routes
 */

import { Hono } from 'hono'
import { ${pascalName}Service } from '../services/${pascalName}Service'

export const ${featureName}Routes = new Hono()

// GET /api/${featureName}
${featureName}Routes.get('/', async (c) => {
  try {
    const service = new ${pascalName}Service(c.env)
    const data = await service.getData()
    
    return c.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('[${pascalName}] Error:', error)
    return c.json({
      success: false,
      error: (error as Error).message
    }, 500)
  }
})

// POST /api/${featureName}
${featureName}Routes.post('/', async (c) => {
  try {
    const body = await c.req.json()
    const service = new ${pascalName}Service(c.env)
    const result = await service.create(body)
    
    return c.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('[${pascalName}] Error:', error)
    return c.json({
      success: false,
      error: (error as Error).message
    }, 500)
  }
})

export default ${featureName}Routes
`

// 2. Zustand Store
const storeTemplate = `/**
 * ${pascalName} Store (Zustand)
 */

import { create } from 'zustand'
import { ${pascalName}Service } from '../services/${pascalName}Service'
import type { ${pascalName}Data } from '../types'

interface ${pascalName}State {
  // State
  data: ${pascalName}Data | null
  loading: boolean
  error: string | null
  
  // Actions
  fetch: () => Promise<void>
  create: (data: Partial<${pascalName}Data>) => Promise<void>
  update: (id: string, data: Partial<${pascalName}Data>) => Promise<void>
  delete: (id: string) => Promise<void>
  reset: () => void
}

export const use${pascalName}Store = create<${pascalName}State>((set, get) => ({
  // Initial state
  data: null,
  loading: false,
  error: null,
  
  // Fetch data
  fetch: async () => {
    set({ loading: true, error: null })
    try {
      const service = new ${pascalName}Service()
      const data = await service.getData()
      set({ data, loading: false })
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
    }
  },
  
  // Create
  create: async (newData: Partial<${pascalName}Data>) => {
    set({ loading: true, error: null })
    try {
      const service = new ${pascalName}Service()
      const data = await service.create(newData)
      set({ data, loading: false })
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
    }
  },
  
  // Update
  update: async (id: string, updates: Partial<${pascalName}Data>) => {
    set({ loading: true, error: null })
    try {
      const service = new ${pascalName}Service()
      const data = await service.update(id, updates)
      set({ data, loading: false })
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
    }
  },
  
  // Delete
  delete: async (id: string) => {
    set({ loading: true, error: null })
    try {
      const service = new ${pascalName}Service()
      await service.delete(id)
      set({ data: null, loading: false })
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
    }
  },
  
  // Reset
  reset: () => {
    set({ data: null, loading: false, error: null })
  }
}))
`

// 3. React Component
const componentTemplate = `/**
 * ${pascalName} Component
 */

import { useEffect } from 'react'
import { use${pascalName}Store } from '../stores/use${pascalName}Store'

export function ${pascalName}Component() {
  const { data, loading, error, fetch } = use${pascalName}Store()
  
  useEffect(() => {
    fetch()
  }, [fetch])
  
  if (loading) {
    return <div className="text-center py-8">로딩 중...</div>
  }
  
  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        에러: {error}
      </div>
    )
  }
  
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">${pascalName}</h1>
      {data ? (
        <div>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      ) : (
        <div>데이터가 없습니다</div>
      )}
    </div>
  )
}
`

// 4. Service
const serviceTemplate = `/**
 * ${pascalName} Service
 */

import api from '@/lib/api'
import type { ${pascalName}Data } from '../types'

export class ${pascalName}Service {
  private env?: any
  
  constructor(env?: any) {
    this.env = env
  }
  
  async getData(): Promise<${pascalName}Data> {
    const response = await api.get('/api/${featureName}')
    return response.data
  }
  
  async create(data: Partial<${pascalName}Data>): Promise<${pascalName}Data> {
    const response = await api.post('/api/${featureName}', data)
    return response.data
  }
  
  async update(id: string, data: Partial<${pascalName}Data>): Promise<${pascalName}Data> {
    const response = await api.put(\`/api/${featureName}/\${id}\`, data)
    return response.data
  }
  
  async delete(id: string): Promise<void> {
    await api.delete(\`/api/${featureName}/\${id}\`)
  }
}
`

// 5. Types
const typesTemplate = `/**
 * ${pascalName} Types
 */

export interface ${pascalName}Data {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface ${pascalName}CreateRequest {
  name: string
  description?: string
}

export interface ${pascalName}UpdateRequest {
  name?: string
  description?: string
}

export interface ${pascalName}Response {
  success: boolean
  data?: ${pascalName}Data
  error?: string
}
`

// 6. Test
const testTemplate = `/**
 * ${pascalName} Store Tests
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { use${pascalName}Store } from '../stores/use${pascalName}Store'

describe('use${pascalName}Store', () => {
  beforeEach(() => {
    // Reset store before each test
    const { reset } = use${pascalName}Store.getState()
    reset()
  })
  
  it('should fetch data successfully', async () => {
    const { result } = renderHook(() => use${pascalName}Store())
    
    await act(async () => {
      await result.current.fetch()
    })
    
    await waitFor(() => {
      expect(result.current.data).toBeTruthy()
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })
  
  it('should handle error', async () => {
    // TODO: Mock service to throw error
    const { result } = renderHook(() => use${pascalName}Store())
    
    await act(async () => {
      await result.current.fetch()
    })
    
    await waitFor(() => {
      expect(result.current.error).toBeTruthy()
    })
  })
  
  it('should create data', async () => {
    const { result } = renderHook(() => use${pascalName}Store())
    
    await act(async () => {
      await result.current.create({ name: 'Test' })
    })
    
    await waitFor(() => {
      expect(result.current.data).toBeTruthy()
      expect(result.current.data?.name).toBe('Test')
    })
  })
  
  it('should reset state', () => {
    const { result } = renderHook(() => use${pascalName}Store())
    
    act(() => {
      result.current.reset()
    })
    
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })
})
`

// 7. Index (Public API)
const indexTemplate = `/**
 * ${pascalName} Feature - Public API
 */

// Routes
export { default as ${featureName}Routes } from './api/${featureName}.routes'

// Stores
export { use${pascalName}Store } from './stores/use${pascalName}Store'

// Components
export { ${pascalName}Component } from './components/${pascalName}Component'

// Services
export { ${pascalName}Service } from './services/${pascalName}Service'

// Types
export type * from './types'
`

// Write files
const files = [
  { path: `api/${featureName}.routes.ts`, content: apiRouteTemplate },
  { path: `stores/use${pascalName}Store.ts`, content: storeTemplate },
  { path: `components/${pascalName}Component.tsx`, content: componentTemplate },
  { path: `services/${pascalName}Service.ts`, content: serviceTemplate },
  { path: `types/index.ts`, content: typesTemplate },
  { path: `__tests__/${featureName}.test.ts`, content: testTemplate },
  { path: 'index.ts', content: indexTemplate }
]

files.forEach(file => {
  const filePath = path.join(featureDir, file.path)
  fs.writeFileSync(filePath, file.content)
  console.log(`✅ Created ${path.relative(process.cwd(), filePath)}`)
})

console.log('')
console.log('🎉 Feature created successfully!')
console.log('')
console.log('📝 Next steps:')
console.log('1. Implement business logic in services/')
console.log('2. Update types in types/index.ts')
console.log('3. Write tests in __tests__/')
console.log('4. Register routes in src/worker/index.ts:')
console.log(`   import { ${featureName}Routes } from '@/features/${featureName}'`)
console.log(`   app.route('/api/${featureName}', ${featureName}Routes)`)
console.log('')
console.log('5. Run tests:')
console.log('   npm run test')
console.log('')
console.log('6. Build and verify:')
console.log('   npm run build:kr')
console.log('   npm run build:global')
