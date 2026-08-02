# Walkie-Talkie (Terminal CLI Chat App)

A full-stack Terminal CLI Chat Application built with Node.js, React (via Ink), and Socket.io. This app brings a modern, real-time chat experience straight to your terminal!

## 🚀 Features

- **Real-time Messaging**: Instant communication using `socket.io`.
- **Terminal UI**: Built with React and `ink` for a rich, interactive CLI experience.
- **Authentication**: Secure user authentication using JWT and `bcryptjs`.
- **Database**: PostgreSQL (`pg`) for persistent storage of users and messages.
- **Caching**: Redis for session management and performance optimization.
- **Dockerized**: Easy setup and deployment with Docker Compose.

## 🛠️ Tech Stack

### Client (CLI)
- Node.js
- React (rendered in terminal)
- [Ink](https://github.com/vadimdemedes/ink) (React for CLI)
- Socket.io Client
- Axios

### Server
- Node.js & Express.js
- Socket.io
- PostgreSQL
- Redis
- JSON Web Tokens (JWT) & bcrypt

## 📦 Prerequisites

Make sure you have the following installed on your system:
- Node.js (v18+ recommended)
- PostgreSQL
- Redis
- Docker & Docker Compose (optional, but recommended for easy database setup)

## 🏗️ Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Karthickasenthilnathan/Walkie-Talkie.git
   cd Walkie-Talkie
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   Configure your `.env` file in the root directory. You can use the provided variables as a reference for connecting to Postgres and Redis.

4. **Start the Databases (via Docker Compose):**
   If you have Docker installed, you can easily spin up PostgreSQL and Redis:
   ```bash
   docker-compose up -d
   ```

5. **Run Database Migrations:**
   ```bash
   npm run migrate
   ```

## 🎮 Running the Application

### Start the Server
To run the server in development mode (with auto-reloading):
```bash
npm run dev
```
To run the server in production mode:
```bash
npm start
```

### Start the Client (CLI App)
Open a new terminal window and run:
```bash
npm run client
```
