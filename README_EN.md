# Wesnoth Tournament Manager

A complete web application for managing Wesnoth tournaments with ELO ranking system, match reports, admin panel, and multi-language support.

## Features

- ✅ Player registration with password validation
- ✅ Admin panel for approving/rejecting registration requests
- ✅ ELO ranking system (chess.com style)
- ✅ Match reports with replay files
- ✅ Match confirmation by both players
- ✅ Tournament management (create, join, participate)
- ✅ Multiple languages (English, Spanish, Chinese, German, Russian)
- ✅ Automatic player levels

## Prerequisites

- Node.js (v18+)
- Docker and Docker Compose
- PostgreSQL (or use Docker)


## Installation

### Option 1: With Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/clmates/wesnoth_tournament_manager.git
cd wesnoth_tournament_manager

# Copy configuration file
cp backend/.env.example backend/.env

# Edit backend/.env with your values

# Start the services
docker-compose up
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Database: localhost:5432

### Option 2: Local Installation

#### Backend

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your values
# On Windows with PowerShell:
notepad .env
# Or with VS Code:
code .env

# Compile TypeScript
npm run build

# Start server (development)
npm run dev

# Or start in production
npm run start
```

The backend will be available at: `http://localhost:3000`

#### Frontend (in another terminal)

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Or compile for production
npm run build
```

The frontend will be available at: `http://localhost:5173`

---

## 🚀 Complete Local Testing Guide

### Step 1: Prepare the Environment

```bash
# 1. Clone or download the repository
git clone https://github.com/clmates/wesnoth_tournament_manager.git
cd wesnoth_tournament_manager
```

### Step 2: Choose Between Docker or Local

#### **Option A: With Docker (Easier)**

```bash
# 1. Create .env file
cp backend/.env.example backend/.env

# 2. Start everything with Docker
docker-compose up

# Wait for the database to initialize (you'll see messages in the console)
# The first execution may take a few minutes
```

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/health
- Database: localhost:5432 (user: postgres, password: postgres)

#### **Option B: Local (Without Docker)**

**Requirements:**
- PostgreSQL running locally (or in Docker only)
- Node.js v18+

```bash
# Terminal 1: Start Database (Optional - if you use Docker for DB only)
docker run -d \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=wesnoth_tournament \
  -p 5432:5432 \
  postgres:16-alpine

# Terminal 2: Backend
cd backend
npm install
cp .env.example .env
npm run dev
# Wait for message: "Server running on port 3000"

# Terminal 3: Frontend
cd frontend
npm install
npm run dev
# Wait for message: "Local: http://localhost:5173"
```

---

## 📝 Functionality Tests

### 1. **User Registration**

```
URL: http://localhost:5173/register
- Nick: TestPlayer1
- Email: test1@example.com
- Password: Test@12345
- Language: English
- Discord ID: (optional)
```

This creates a **pending registration request**.

### 2. **Approve Registration (Admin)**

You need admin access. In the database, run:

```sql
-- Connect to PostgreSQL
psql -U postgres -d wesnoth_tournament

-- Make the first user admin
UPDATE users SET is_admin = true WHERE nickname = 'TestPlayer1';
```

Then access: `http://localhost:3000/api/admin/registration-requests`

### 3. **Login**

```
URL: http://localhost:5173/login
- Nick: TestPlayer1
- Password: Test@12345
```

### 4. **Create two test users**

```bash
# Terminal (in backend)
cd backend
node -e "
const crypto = require('crypto');
console.log('Random UUID:', crypto.randomUUID());
"
```

Repeat the registration process 2 times to have 2 users (you'll need to approve both).

### 5. **Report a Match**

- Login as player 1
- Go to "Report Match"
- Select Player 2 as opponent
- Fill in data (Map, Factions, Comments, Rating)
- Submit

### 6. **Confirm Match**

- Logout
- Login as player 2
- View pending matches
- Confirm/Dispute the match

### 7. **View Ranking**

- Both players will see their updated ELO
- Check in "Global Ranking"

---

## 🔧 Environment Variables

### Backend (.env)

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wesnoth_tournament
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wesnoth_tournament
DB_USER=postgres
DB_PASSWORD=<passwordhere>

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-min-32-characters
JWT_EXPIRATION=7d

# Server
PORT=3000
NODE_ENV=development

# URLs
FRONTEND_URL=http://localhost:5173
```

---

## 📊 Database Structure

```sql
-- View structure
\dt

-- View users
SELECT id, nickname, email, is_admin, is_active FROM users;

-- View matches
SELECT * FROM matches;

-- View pending requests
SELECT * FROM registration_requests WHERE status = 'pending';
```

---

## 🐛 Troubleshooting

### Port 3000 in use
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3000
kill -9 <PID>
```

### Port 5173 in use
```bash
# Windows
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

### Database connection error
```bash
# Verify that PostgreSQL is running
# If you use Docker:
docker ps

# Verify credentials in .env
# By default:
# User: postgres
# Password: postgres
# Port: 5432
```

## 📱 Using Different Languages

- Buttons in Navbar: EN | ES | ZH | DE | RU
- Translations will change automatically
- Language will be saved in localStorage

---

## Project Structure

```
wesnoth_tournament_manager/
├── backend/
│   ├── src/
│   │   ├── config/          # Database configuration
│   │   ├── middleware/      # Authentication middleware
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic services
│   │   ├── types/           # TypeScript types
│   │   ├── utils/           # Utilities (Auth, Translation)
│   │   ├── app.ts           # Express configuration
│   │   └── server.ts        # Entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Pages
│   │   ├── services/        # API calls
│   │   ├── store/           # Global state (Zustand)
│   │   ├── i18n/            # i18n configuration
│   │   ├── styles/          # CSS styles
│   │   ├── types/           # TypeScript types
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── docker-compose.yml
├── .gitignore
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - Login
- `POST /api/auth/change-password` - Change password

### Users
- `GET /api/users/profile` - User profile
- `GET /api/users/:id/stats` - User statistics
- `GET /api/users/:id/matches` - Latest matches
- `GET /api/users/search/:query` - Search users
- `GET /api/users/ranking/global` - Global ranking

### Matches
- `POST /api/matches/report` - Report match
- `POST /api/matches/:id/confirm` - Confirm match
- `GET /api/matches` - Get all matches

### Tournaments
- `POST /api/tournaments` - Create tournament
- `GET /api/tournaments` - Get tournaments
- `GET /api/tournaments/:id` - Get tournament details
- `POST /api/tournaments/:id/join` - Join tournament
- `GET /api/tournaments/:id/ranking` - Tournament ranking

### Administration
- `GET /api/admin/registration-requests` - Pending requests
- `POST /api/admin/registration-requests/:id/approve` - Approve registration
- `POST /api/admin/registration-requests/:id/reject` - Reject registration
- `POST /api/admin/users/:id/block` - Block user
- `POST /api/admin/users/:id/unblock` - Unblock user
- `PUT /api/admin/password-policy` - Update password policy
- `POST /api/admin/news` - Create news
- `PUT /api/admin/news/:id` - Edit news

## Main Features

### ELO System
- Based on chess rating system
- K-factor: 32
- Automatic levels: Novice, Beginner, Veteran, Expert, Master

### Password Policy
- Configurable minimum length (default: 8)
- Requirements: uppercase, lowercase, numbers, symbols
- Previous passwords not allowed (default: 5)

### Tournament System
- Swiss system with multiple rounds
- Quarterfinals and finals
- Tournament-specific ranking
- Match reporting within tournament

### Multi-language
- English, Spanish, Chinese, German, Russian
- Language selector in interface

## Other Features

- 📊 Advanced statistics
- 🎮 Discord integration

## Contributing

Contributions are welcome. Please:

1. Fork the project
2. Create a branch for your feature (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the **GNU Affero General Public License v3 (AGPL-3.0-or-later)**.

### What does AGPL mean?

- ✅ **Free use**: You can use this software freely
- ✅ **Free modification**: You can modify and adapt the code
- ✅ **Free distribution**: You can share the software

#### Main requirement:

**If you run this software as a service accessible over the network**, you must provide the source code to users who access the service.

This means:
- If you deploy this application on a server and users access it via web, you must share the source code with them
- Any modifications you make must be accessible to users of the service
- Users can view, audit, and improve the code

### Why AGPL?

This license reflects our values:
- **Transparency**: Service code is visible to users
- **Community**: Improvements benefit everyone
- **Trust**: Users can verify it works as expected
- **Security**: Code can be audited by anyone

### Dependency Licenses

See [DEPENDENCIES_AND_LICENSES.md](DEPENDENCIES_AND_LICENSES.md) for information about the licenses of all libraries used.

All dependencies are compatible with AGPL-3.0.

### Commercial License

If you need to use this software without AGPL requirements (for example, for a private service without sharing code), you can contact the authors to negotiate a commercial license.

## Contact

For questions or suggestions, contact: support@wesnoth-tournament.com
