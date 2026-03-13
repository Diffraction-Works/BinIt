# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-03-13

### Security
- Added Content Security Policy (CSP) meta tag with restrictive policies
- Fixed XSS vulnerability via thoughtId parameter using escapeCssSelector()
- Expanded .gitignore with 25+ security and hygiene patterns

### Fixed
- Fixed DOM removal before database update race condition
- Fixed drag operation race condition with batch transaction
- Fixed trash can hiding prematurely during drag operations

### Added
- Implemented DataCache with 5s TTL to reduce redundant queries
- Added CalendarCache with memoization to prevent excessive re-renders
- Added LoadingState manager for user feedback during operations
- Added KeyboardDragState with tabIndex and arrow key support

### Changed
- Converted callback patterns to consistent async/await throughout codebase
- Defined TIMING, PARTICLE, TEXT constants to replace magic numbers
- Improved error handling with user-visible toast notifications

## [1.0.0] - 2026-03-12

### Added
- Thought writing with customizable retention periods (1 month to 1 year)
- Drag & drop with realistic crumpling physics for virtual trash can
- Glass-morphism UI with black and white aesthetic
- Calendar/Timeline view for pending thoughts due for review
- Memorial section for preserved memories
- Particle effects when burning thoughts
- Offline support via Service Worker
- Data persistence with IndexedDB and localStorage
- PWA installation capability

### Technology
- Vanilla JavaScript
- CSS3 (glass-morphism, animations)
- IndexedDB
- Service Worker
- Progressive Web App (PWA)
