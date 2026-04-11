# Product Reference Manager - Production Guide

## Overview

The Product Reference Manager is a modern, industry-grade web application built with React 19, TypeScript, and Tailwind CSS. It provides comprehensive product inventory management with features including product tracking, reference generation, search, export/import capabilities, and persistent data storage.

## Architecture & Design Philosophy

### Modern Enterprise Dashboard Design

The application follows a contemporary enterprise minimalism aesthetic inspired by modern SaaS platforms (Figma, Linear, Notion). The design emphasizes:

- **Data Clarity First**: Every UI element serves information hierarchy with minimal decoration
- **Functional Elegance**: Smooth transitions and micro-interactions that feel responsive
- **Professional Restraint**: Refined color palette with strategic accent colors
- **Accessibility by Design**: High contrast ratios, clear focus states, keyboard-first interactions

### Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Frontend Framework | React | 19.2.1 |
| Language | TypeScript | 5.6.3 |
| Styling | Tailwind CSS | 4.1.14 |
| UI Components | shadcn/ui | Latest |
| Routing | Wouter | 3.3.5 |
| Icons | Lucide React | 0.453.0 |
| Notifications | Sonner | 2.0.7 |
| Build Tool | Vite | 7.1.7 |
| Package Manager | pnpm | 10.4.1 |

## Project Structure

```
product-manager-app/
├── client/                          # Frontend application
│   ├── src/
│   │   ├── components/
│   │   │   ├── ProductTable.tsx     # Main product management component
│   │   │   ├── ui/                  # shadcn/ui components
│   │   │   └── ErrorBoundary.tsx    # Error handling
│   │   ├── pages/
│   │   │   ├── Home.tsx             # Main page
│   │   │   └── NotFound.tsx         # 404 page
│   │   ├── hooks/
│   │   │   └── useProductStorage.ts # Custom storage hook
│   │   ├── contexts/
│   │   │   ├── ThemeContext.tsx     # Theme management
│   │   │   └── SettingsContext.tsx  # App settings
│   │   ├── lib/
│   │   │   └── productUtils.ts      # Utility functions
│   │   ├── App.tsx                  # Main app component
│   │   ├── main.tsx                 # Entry point
│   │   └── index.css                # Global styles & design tokens
│   ├── public/                      # Static assets
│   └── index.html                   # HTML template
├── server/                          # Backend (Express)
│   └── index.ts                     # Server configuration
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript configuration
├── vite.config.ts                   # Vite configuration
└── tailwind.config.ts               # Tailwind configuration
```

## Core Features

### Product Management

The application provides a comprehensive product management interface with the following capabilities:

**Add Products**: Users can add new products with automatic reference code generation. The system validates input, prevents duplicates, and provides real-time suggestions based on existing products and categories.

**Search & Filter**: A powerful search function allows filtering products by name, category, or reference code. Results update in real-time as users type.

**Delete Products**: Users can remove products from the inventory with a single click. Deleted products are immediately removed from the display and storage.

**Export to Excel**: The application generates Excel-compatible backup files with timestamps. Files are automatically named with the current date and time for easy organization.

**Import from Excel**: Users can restore products from previously exported Excel files. The import process validates data integrity and provides feedback on the number of products imported.

**Auto Backup**: An optional auto-backup feature automatically downloads a backup file whenever a new product is added, ensuring data safety.

**Duplicate Detection**: The system prevents duplicate product names and alerts users if they attempt to add a product that already exists.

## Data Persistence

### LocalStorage Strategy

The application uses browser LocalStorage for data persistence:

- **Products Data**: Stored as JSON under the key `products`
- **Settings**: Auto-backup preference stored under `autoBackup`
- **Theme**: User theme preference stored under `theme`

### Storage Monitoring

The application includes built-in storage monitoring:

- Automatic detection of LocalStorage availability
- User warnings if storage becomes unavailable
- Graceful fallback to in-memory storage if needed

## Deployment Instructions

### Prerequisites

- Node.js 18+ or higher
- pnpm 10.4.1+
- Modern web browser with LocalStorage support

### Local Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# The application will be available at http://localhost:3000
```

### Production Build

```bash
# Build for production
pnpm build

# Preview production build locally
pnpm preview

# Start production server
pnpm start
```

### Deployment to Local Production Server

#### Option 1: Direct Node.js Deployment

```bash
# 1. Build the application
pnpm build

# 2. Transfer the dist/ folder to your production server
scp -r dist/ user@production-server:/var/www/product-manager-app/

# 3. On the production server, install dependencies
cd /var/www/product-manager-app
pnpm install --prod

# 4. Start the application with PM2 (recommended)
pm2 start dist/index.js --name "product-manager-app"
pm2 save
pm2 startup
```

#### Option 2: Docker Deployment

Create a `Dockerfile` in the project root:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN npm install -g pnpm && pnpm install --prod

# Copy built application
COPY dist ./dist

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "dist/index.js"]
```

Build and run:

```bash
# Build Docker image
docker build -t product-manager-app:latest .

# Run container
docker run -d -p 3000:3000 --name product-manager-app product-manager-app:latest
```

#### Option 3: Nginx Reverse Proxy

```nginx
upstream product_manager {
    server localhost:3000;
}

server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://product_manager;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Environment Configuration

The application supports environment variables for configuration:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment mode | production |

### Setting Environment Variables

**Linux/macOS:**
```bash
export PORT=8080
export NODE_ENV=production
pnpm start
```

**Windows (PowerShell):**
```powershell
$env:PORT = 8080
$env:NODE_ENV = production
pnpm start
```

## Performance Optimization

### Build Optimization

The application includes several performance optimizations:

- **Code Splitting**: Vite automatically splits code for optimal loading
- **Tree Shaking**: Unused code is removed during build
- **CSS Purging**: Unused Tailwind styles are removed
- **Asset Optimization**: Images and static files are optimized

### Runtime Optimization

- **Memoization**: React components use useMemo for expensive computations
- **Lazy Loading**: Components are lazy-loaded where appropriate
- **Event Debouncing**: Search input uses debouncing to reduce re-renders
- **Virtual Scrolling**: Large lists can be virtualized if needed

## Security Best Practices

### Data Security

- **Input Validation**: All user inputs are validated before processing
- **XSS Prevention**: React's built-in XSS protection is used
- **LocalStorage Isolation**: Data is isolated per origin
- **No Sensitive Data**: The application does not store sensitive information

### Deployment Security

- **HTTPS**: Always use HTTPS in production
- **Security Headers**: Configure appropriate security headers in your web server
- **CORS**: Configure CORS appropriately for your domain
- **Environment Variables**: Never commit secrets to version control

### Recommended Security Headers

```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
```

## Monitoring & Maintenance

### Health Checks

Implement health checks for your production deployment:

```bash
# Check if application is running
curl http://localhost:3000/

# Response should be the HTML page
```

### Logging

The application logs to console. For production, consider:

- Redirecting logs to a file: `pnpm start > app.log 2>&1`
- Using a logging service like Winston or Pino
- Monitoring with tools like PM2 Plus or New Relic

### Backup Strategy

For production deployments:

- **Daily Backups**: Regularly backup the application directory
- **Database Backups**: If using a database, implement regular backups
- **Version Control**: Maintain version control for all code changes
- **Disaster Recovery**: Test recovery procedures regularly

## Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

**LocalStorage Not Available**
The application will display a warning. Ensure:
- Cookies/storage are enabled in browser
- Not in private/incognito mode
- Not running in an iframe with restricted permissions

**Build Failures**
```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm build
```

## Support & Maintenance

### Regular Maintenance Tasks

- **Dependency Updates**: Run `pnpm update` monthly to keep dependencies current
- **Security Audits**: Run `pnpm audit` to check for vulnerabilities
- **Performance Monitoring**: Monitor application performance in production
- **User Feedback**: Collect and act on user feedback

### Updating the Application

```bash
# Pull latest changes
git pull origin main

# Install dependencies
pnpm install

# Build
pnpm build

# Restart application (if using PM2)
pm2 restart product-manager-app
```

## Performance Metrics

### Target Metrics

- **First Contentful Paint (FCP)**: < 1.5s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Time to Interactive (TTI)**: < 3.5s
- **Cumulative Layout Shift (CLS)**: < 0.1

### Monitoring

Use tools like:
- Google Lighthouse
- WebPageTest
- New Relic
- Datadog

## License

This application is proprietary software. All rights reserved.

## Support

For issues or questions, please contact your development team or system administrator.

---

**Last Updated**: April 2026  
**Version**: 1.0.0  
**Status**: Production Ready
