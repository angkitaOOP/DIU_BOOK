# DIULink Frontend

A responsive React + Vite frontend prototype for DIULink, a DIU-exclusive social and professional networking platform.

## Run locally

1. Install Node.js (LTS).
2. Open this folder in VS Code.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open the localhost URL printed by Vite (usually http://localhost:5173).

## Included screens

- Role-based sign up and sign in (Student, Alumni) with DIU-email checks, student ID, alumni proof upload and a 6-digit email code (demo code: 123456). All checks are client-side only; enforce them on the server.
- Home dashboard and campus feed
- Persistent sidebar navigation, including **Messages** and **Notifications**
- Member profile page, opened by clicking the profile card in the sidebar or the avatar menu
- Profile tabs: Overview, Posts, About, Projects
- Profile overview: cover, DIU verification indicator, bio, education, skills, featured projects, activity, profile strength, and social links
- Responsive desktop and mobile layouts

- Messages (working chat), Notifications, My Network, Explore, Jobs & Internships, Campus Events, Clubs, Alumni Connect, Saved Posts, Settings (all in `src/Pages.jsx`)

## Notes

This is a frontend demonstration. Profile data, connections, and interactions are sample data held in React state. Authentication, persistence, file uploads, messaging, and notifications need backend/API integration.

## Tech stack

- React 18
- Vite 6
- CSS
- lucide-react icons
