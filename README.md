# SmallBiz Ledger

A modern, offline-first ledger application built with Ionic and Angular for small business cash flow management.

## Overview

SmallBiz Ledger is a Progressive Web App (PWA) designed to help small business owners track their income, expenses, and cash flow with ease. It features offline SQLite storage, recurring transaction support, category-based reporting, and Excel export capabilities.

## Features

- **Offline-First**: Works without internet connection using local SQLite database
- **Transaction Management**: Add, edit, and delete income/expense transactions
- **Recurring Transactions**: Set up automatic recurring income/expense entries
- **Category Tracking**: Organize transactions by customizable categories
- **Date Filtering**: Filter transactions by date ranges with preset options
- **Visual Reports**: Monthly trend charts and category breakdowns
- **Excel Export**: Export filtered transactions to XLSX format
- **Dark Mode**: Toggle between light and dark themes
- **Responsive Design**: Optimized for mobile and desktop use

## Tech Stack

- **Framework**: Angular 20 with standalone components
- **UI Library**: Ionic 8
- **Database**: SQLite via Capacitor Community Plugin
- **Build Tool**: Angular CLI
- **Export**: XLSX library for Excel generation
- **Platform**: Capacitor for cross-platform deployment

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Angular CLI (`npm install -g @angular/cli`)
- Capacitor CLI (`npm install -g @capacitor/cli`)

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd smallbiz-ledger
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Add platforms (optional, for mobile deployment):
   ```bash
   npx cap add android
   npx cap add ios
   ```

## Usage

### Development Server

Start the development server:
```bash
npm start
```
The app will be available at `http://localhost:4200/`

### Production Build

Build for production:
```bash
npm run build
```

### Mobile Deployment

After building, sync with Capacitor:
```bash
npx cap sync
```

Then open in your preferred IDE:
```bash
npx cap open android  # For Android Studio
npx cap open ios      # For Xcode
```

## Project Structure

```
src/
├── app/
│   ├── home/                 # Main ledger page
│   │   ├── home.page.html    # UI template
│   │   ├── home.page.ts      # Component logic
│   │   └── home.page.scss    # Styles
│   ├── services/
│   │   └── database.service.ts # SQLite database operations
│   ├── models/
│   │   └── transaction.model.ts # Data models
│   ├── app.component.ts      # Root component
│   ├── app.routes.ts         # Routing configuration
│   └── app.module.ts         # Module configuration
├── assets/                   # Static assets
├── environments/             # Environment configurations
└── main.ts                   # Application bootstrap
```

## Key Components

### Database Service
Handles all SQLite operations including:
- Database initialization and schema creation
- CRUD operations for transactions
- Recurring transaction generation
- Data export functionality

### Home Page Component
Main application interface featuring:
- Transaction form with validation
- Filter controls and search
- Summary cards and charts
- Recurring transaction management
- Export functionality

## Development

### Code Style
- Uses Angular CLI default linting rules
- Follows Ionic design patterns
- TypeScript strict mode enabled

### Testing
Run unit tests:
```bash
npm test
```

### Linting
Check code quality:
```bash
npm run lint
```

## Browser Compatibility

- Modern browsers with ES2020 support
- SQLite Web support via jeep-sqlite for browser testing
- PWA features require HTTPS in production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions, please open an issue on the GitHub repository.