// ***********************************************************
// This support file is loaded before all test files.
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands'
import '@testing-library/cypress/add-commands'

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Prevent Cypress from failing on uncaught exceptions
Cypress.on('uncaught:exception', (err, runnable) => {
  // Firebase, React, or third-party library errors that don't affect tests
  if (
    err.message.includes('Firebase') ||
    err.message.includes('ResizeObserver') ||
    err.message.includes('Kakao') ||
    err.message.includes('Cannot read properties of null')
  ) {
    return false
  }
  
  // Let other errors fail the test
  return true
})

// Custom global configuration
Cypress.Commands.add('waitForReact', (timeout = 2000) => {
  cy.wait(timeout)
})

// Add custom viewport sizes
Cypress.Commands.add('setMobileViewport', () => {
  cy.viewport('iphone-x')
})

Cypress.Commands.add('setTabletViewport', () => {
  cy.viewport('ipad-2')
})

Cypress.Commands.add('setDesktopViewport', () => {
  cy.viewport(1280, 720)
})

// Declare custom commands for TypeScript
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Wait for React to finish rendering
       * @param timeout - Wait time in milliseconds (default: 2000)
       */
      waitForReact(timeout?: number): Chainable<void>
      
      /**
       * Set viewport to mobile size (iPhone X)
       */
      setMobileViewport(): Chainable<void>
      
      /**
       * Set viewport to tablet size (iPad 2)
       */
      setTabletViewport(): Chainable<void>
      
      /**
       * Set viewport to desktop size (1280x720)
       */
      setDesktopViewport(): Chainable<void>
    }
  }
}

export {}
