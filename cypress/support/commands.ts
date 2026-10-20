// ***********************************************
// Custom Cypress commands
// ***********************************************

import '@testing-library/cypress/add-commands'

/**
 * Login as a regular user (Firebase)
 */
Cypress.Commands.add('loginAsUser', (email?: string, password?: string) => {
  const userEmail = email || Cypress.env('TEST_USER_EMAIL')
  const userPassword = password || Cypress.env('TEST_USER_PASSWORD')
  
  cy.visit('/login')
  cy.get('[data-testid="email-input"]', { timeout: 10000 }).should('be.visible').type(userEmail)
  cy.get('[data-testid="password-input"]').type(userPassword)
  cy.get('[data-testid="login-submit"]').click()
  
  // Wait for redirect to user dashboard/profile
  cy.url().should('include', '/user', { timeout: 10000 })
})

/**
 * Login as a seller (JWT)
 */
Cypress.Commands.add('loginAsSeller', (email?: string, password?: string) => {
  const sellerEmail = email || Cypress.env('TEST_SELLER_EMAIL')
  const sellerPassword = password || Cypress.env('TEST_SELLER_PASSWORD')
  
  cy.visit('/seller/login')
  cy.get('[data-testid="email-input"]', { timeout: 10000 }).should('be.visible').type(sellerEmail)
  cy.get('[data-testid="password-input"]').type(sellerPassword)
  cy.get('[data-testid="login-submit"]').click()
  
  // Wait for redirect to seller dashboard
  cy.url().should('include', '/seller/dashboard', { timeout: 10000 })
})

/**
 * Login as an admin (JWT)
 */
Cypress.Commands.add('loginAsAdmin', (email?: string, password?: string) => {
  const adminEmail = email || Cypress.env('TEST_ADMIN_EMAIL')
  const adminPassword = password || Cypress.env('TEST_ADMIN_PASSWORD')
  
  cy.visit('/admin/login')
  cy.get('[data-testid="email-input"]', { timeout: 10000 }).should('be.visible').type(adminEmail)
  cy.get('[data-testid="password-input"]').type(adminPassword)
  cy.get('[data-testid="login-submit"]').click()
  
  // Wait for redirect to admin panel
  cy.url().should('include', '/admin', { timeout: 10000 })
})

/**
 * Logout from any authentication state
 */
Cypress.Commands.add('logout', () => {
  cy.get('[data-testid="user-menu"]', { timeout: 5000 }).click()
  cy.get('[data-testid="logout-button"]').click()
  
  // Wait for redirect to login page
  cy.url().should('include', '/login')
})

/**
 * Clear all authentication state
 */
Cypress.Commands.add('clearAuth', () => {
  cy.clearLocalStorage()
  cy.clearCookies()
  cy.window().then((win) => {
    win.sessionStorage.clear()
  })
})

/**
 * Mock API response
 */
Cypress.Commands.add('mockApiResponse', (url: string, method: string, response: any, statusCode = 200) => {
  cy.intercept(method, url, {
    statusCode,
    body: response,
  }).as('mockedRequest')
})

/**
 * Wait for API call
 */
Cypress.Commands.add('waitForApi', (url: string, alias?: string) => {
  const interceptAlias = alias || 'apiCall'
  cy.intercept('*' + url).as(interceptAlias)
  cy.wait(`@${interceptAlias}`, { timeout: 10000 })
})

/**
 * Check if element exists without failing
 */
Cypress.Commands.add('elementExists', (selector: string) => {
  return cy.get('body').then(($body) => {
    return $body.find(selector).length > 0
  })
})

/**
 * Type slowly (simulate human typing)
 */
Cypress.Commands.add('typeSlowly', { prevSubject: true }, (subject, text: string, delay = 100) => {
  return cy.wrap(subject).type(text, { delay })
})

// Declare custom commands for TypeScript
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Login as a regular user (Firebase)
       */
      loginAsUser(email?: string, password?: string): Chainable<void>
      
      /**
       * Login as a seller (JWT)
       */
      loginAsSeller(email?: string, password?: string): Chainable<void>
      
      /**
       * Login as an admin (JWT)
       */
      loginAsAdmin(email?: string, password?: string): Chainable<void>
      
      /**
       * Logout from any authentication state
       */
      logout(): Chainable<void>
      
      /**
       * Clear all authentication state
       */
      clearAuth(): Chainable<void>
      
      /**
       * Mock API response
       */
      mockApiResponse(url: string, method: string, response: any, statusCode?: number): Chainable<void>
      
      /**
       * Wait for API call
       */
      waitForApi(url: string, alias?: string): Chainable<void>
      
      /**
       * Check if element exists without failing
       */
      elementExists(selector: string): Chainable<boolean>
      
      /**
       * Type text slowly (simulate human typing)
       */
      typeSlowly(text: string, delay?: number): Chainable<JQuery<HTMLElement>>
    }
  }
}

export {}
