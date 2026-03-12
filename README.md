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

## Deployment to GitHub Pages

1. **Create a GitHub repository**
   - Go to [GitHub](https://github.com) and create a new repository

2. **Push all files to the repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/username/repo-name.git
   git push -u origin main
   ```

3. **Configure GitHub Pages**
   - Go to your repository on GitHub
   - Click **Settings** → **Pages**
   - Under "Build and deployment", select **main** branch
   - Click **Save**

4. **Access your deployed app**
   - Your app will be available at: `https://username.github.io/repo-name/`

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
