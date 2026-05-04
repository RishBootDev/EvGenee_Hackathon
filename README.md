# EvGenee 🚗⚡

EvGenee is a comprehensive Electric Vehicle (EV) charging station finder and management application developed for a hackathon. It connects EV owners with available charging stations in real-time, facilitating easy discovery, booking, and payments.

## ✨ Features

- **Real-Time Station Discovery**: View nearby EV charging stations on an interactive map using Leaflet.
- **Live Availability Status**: Real-time updates on charging slot availability powered by Socket.io.
- **Secure Authentication**: User registration and login using JWT and bcrypt.
- **Seamless Payments**: Integrated with Razorpay for smooth and secure charging session payments.
- **Interactive UI**: A modern, responsive user interface built with React, Tailwind CSS, and Radix UI components.
- **State Management**: Efficient data fetching and state management using TanStack Query and Zustand.

## 🛠️ Tech Stack

### Frontend (`evgenee_frontend`)
- **Framework**: React 19 with Vite
- **Styling**: Tailwind CSS, Radix UI Primitives, Lucide Icons
- **Routing & State**: TanStack Router, TanStack Query, Zustand
- **Maps**: React Leaflet
- **Real-time**: Socket.io-client
- **Forms & Validation**: React Hook Form, Zod

### Backend (`EvGenee_Backend`)
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Real-time**: Socket.io
- **Payments**: Razorpay
- **Security**: JSON Web Tokens (JWT), bcrypt
- **Task Scheduling**: node-cron

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- MongoDB instance (local or Atlas)
- Razorpay API keys

### Installation & Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/RishBootDev/EvGenee_Hackathon.git
   cd EvGenee_Hackathon
   ```

2. **Backend Setup**
   ```bash
   cd EvGenee_Backend
   npm install
   ```
   Create a `.env` file in the `EvGenee_Backend` directory with your required environment variables (e.g., `MONGO_URI`, `JWT_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`).
   
   Start the backend server:
   ```bash
   npm run start
   ```

3. **Frontend Setup**
   Open a new terminal and navigate to the frontend directory:
   ```bash
   cd evgenee_frontend
   npm install
   ```
   Start the frontend development server:
   ```bash
   npm run dev
   ```

4. **Open the Application**
   Open your browser and navigate to the URL provided by Vite (usually `http://localhost:5173`).

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page if you want to contribute.

## 📄 License
This project is licensed under the ISC License.
