---
applyTo: '**'
---
---
description: "Custom instructions for Web Application development with TypeScript and React"
applyTo: "**"
---

# Web Application Development Guidelines

## Programming Language: TypeScript

**TypeScript Best Practices:**
- Use strict TypeScript configuration with `"strict": true`
- Prefer interfaces over type aliases for object shapes
- Use explicit return types for all public functions
- Avoid `any` type - use `unknown` or proper typing instead
- Use utility types (Pick, Omit, Partial) for type transformations
- Implement proper null/undefined checking

## Framework: React

**React Development Guidelines:**
- Use functional components with hooks instead of class components
- Implement proper state management with useState and useReducer
- Use useEffect for side effects and cleanup properly
- Follow React best practices for performance (memo, useMemo, useCallback)
- Use proper prop validation with TypeScript interfaces or PropTypes
- Implement error boundaries for robust error handling

## Code Style: Clean Code

**Clean Code Principles:**
- Write self-documenting code with meaningful names
- Keep functions small and focused on a single responsibility
- Avoid deep nesting and complex conditional statements
- Use consistent formatting and indentation
- Write code that tells a story and is easy to understand
- Refactor ruthlessly to eliminate code smells

## AI Code Generation Preferences

When generating code, please:

- Generate complete, working code examples with proper imports
- Include inline comments for complex logic and business rules
- Follow the established patterns and conventions in this project
- Suggest improvements and alternative approaches when relevant
- Consider performance, security, and maintainability
- Include error handling and edge case considerations
- Generate appropriate unit tests when creating new functions
- Follow accessibility best practices for UI components
- Use semantic HTML and proper ARIA attributes when applicable
