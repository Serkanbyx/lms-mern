# LMS Platform

> Production-grade, full-stack Learning Management System (MERN).
>
> This README is a placeholder created in **STEP 1**. The full README — featuring stack overview, screenshots, demo credentials, environment variable reference, local setup guide, deployment notes, and security/accessibility highlights — is authored later in **STEP 50**.

## Status

Scaffolding in progress. See `STEPS.md` for the full build plan (53 steps).

## Stack (target)

- **Frontend:** React 19 + Vite, React Router v7, TailwindCSS v4, Axios, Framer Motion, React Player, jsPDF, react-helmet-async, lucide-react, react-hot-toast
- **Backend:** Node.js + Express 5, MongoDB + Mongoose 9, JWT (access + rotating refresh), Cloudinary (HLS adaptive video), Multer, Helmet, express-rate-limit (Redis), express-validator, pino
- **Tooling:** ESLint, Vite PWA, Nodemon

## Layout

```
/
├── server/   # Express API
├── client/   # React (Vite) SPA
├── .gitignore
└── README.md
```

## Getting started (will be expanded in STEP 50)

```bash
# Backend
cd server
cp .env.example .env   # fill in real values
npm install
npm run dev

# Frontend (in another terminal)
cd client
cp .env.example .env
npm install
npm run dev
```
