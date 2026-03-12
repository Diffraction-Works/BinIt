# BinIt - Thought Processing App

A single-page web application that allows users to write thoughts, crumple and drag them into a virtual trash can, and after a retention period, either permanently burn them or preserve them as memories.

## Features

- **Write thoughts** with customizable retention periods (1 month to 1 year)
- **Drag and drop** with realistic crumpling physics
- **Glass-morphism** black and white aesthetic
- **Calendar/timeline view** for pending reviews
- **Memorial section** for preserved memories
- **Particle effects** for burning action
- **Offline-capable** with Service Worker
- **IndexedDB + localStorage** for data persistence

## Technology Stack

- Vanilla JavaScript
- CSS3 (glass-morphism, animations)
- IndexedDB
- Service Worker
- PWA (Progressive Web App)

## Local Development

To run locally:

1. Open `index.html` in a modern browser
2. Or serve with a local server:
   ```bash
   npx serve .
   ```

## PWA Installation

When visited on a supported browser, you can install BinIt as a standalone app:
- Click the install icon in the address bar
- Or use "Add to Home Screen" from the browser menu
