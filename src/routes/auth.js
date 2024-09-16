import React, { useState, useContext } from 'react';
import axios from 'axios';
import './LoginForm.css';
import { Context as FormContext } from "../../context/FormContext";

const LoginForm = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { userIdMsg } = useContext(FormContext);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const response = await axios.post('/auth/login', { username, password }, { withCredentials: true });

      console.log('Login response:', response.data);
      if (response.data.success && response.data.userId && response.data.token) {
        localStorage.setItem('userId', response.data.userId);
        localStorage.setItem('token', response.data.token);
        userIdMsg(response.data.userId);
        onLogin({ 
          userId: response.data.userId,
          token: response.data.token
        });
      } else {
        setError('Login failed: Unexpected response from server');
      }
    } catch (error) {
      console.error('Error logging in:', error);
      setError(error.response?.data?.message || 'An error occurred during login');
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>Login</h2>
        {error && <p className="error-message">{error}</p>}
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="login-button">Login</button>
      </form>
    </div>
  );
};

export default LoginForm;
// Updated Authentication Implementation

// auth.js

// const express = require("express");
// const router = express.Router();
// const bcrypt = require("bcrypt");
// const jwt = require("jsonwebtoken");
// const User = require("../models/User");

// const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret"; // Make sure to set this in your environment variables

// // Middleware to verify JWT
// const verifyToken = (req, res, next) => {
//   const token = req.header('Authorization')?.split(' ')[1];

//   if (!token) {
//     return res.status(401).json({ message: "No token provided" });
//   }

//   try {
//     const decoded = jwt.verify(token, JWT_SECRET);
//     req.userId = decoded.userId;
//     next();
//   } catch (error) {
//     return res.status(401).json({ message: "Invalid token" });
//   }
// };

// router.post("/register", async (req, res) => {
//   try {
//     const { username, password } = req.body;

//     const existingUser = await User.findOne({ username });
//     if (existingUser) {
//       return res.status(400).json({ message: "El nombre de usuario ya está en uso" });
//     }

//     const newUser = new User({ username, password });
//     await newUser.save();

//     const token = jwt.sign({ userId: newUser._id }, JWT_SECRET, { expiresIn: '1d' });
//     req.session.userId = newUser._id;

//     res.status(201).json({ message: "Usuario registrado exitosamente", token });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// router.post("/login", async (req, res) => {
//   // console.log('Attempting to log in with:', { username, password });
//   // console.log('Attempting to REQ RES:',req,res)
//   try {
//     const { username, password } = req.body;
//     console.log("Login attempt for username:", username);

//     const user = await User.findOne({ username });
//     console.log("User found:", user ? "Yes" : "No");

//     if (!user) {
//       console.log("Login failed: User not found");
//       return res.status(401).json({ message: "Credenciales inválidas" });
//     }

//     const isPasswordValid = await bcrypt.compare(password, user.password);
//     console.log("Password valid:", isPasswordValid);

//     if (!isPasswordValid) {
//       console.log("Login failed: Invalid password");
//       return res.status(401).json({ message: "Credenciales inválidas" });
//     }

//     const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1d' });
//     req.session.userId = user._id.toString();
//     console.log('Session after setting userId:', req.session);

//     req.session.save((err) => {
//       if (err) {
//         console.error('Error saving session:', err);
//       } else {
//         console.log('Session saved successfully');
//       }
      
//       res.status(200).json({ 
//         success: true,
//         message: "Inicio de sesión exitoso", 
//         userId: user._id,
//         token
//       });
//     });
  
//   } catch (error) {
//     console.error("Login error:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

// router.post("/logout", (req, res) => {
//   req.session.destroy((err) => {
//     if (err) {
//       console.error("Error al cerrar la sesión:", err);
//       res.status(500).json({ message: "Error al cerrar la sesión" });
//     } else {
//       res.clearCookie('connect.sid'); // Clear the session cookie
//       res.json({ message: "Cierre de sesión exitoso" });
//     }
//   });
// });

// router.get("/check", verifyToken, async (req, res) => {
//   try {
//     const user = await User.findById(req.userId);
//     if (user) {
//       return res.json({ isAuthenticated: true, userId: user._id });
//     }
//     res.json({ isAuthenticated: false });
//   } catch (error) {
//     console.error("Error checking authentication:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// router.get("/me", verifyToken, async (req, res) => {
//   try {
//     const user = await User.findById(req.userId);
//     if (!user) {
//       return res.status(404).json({ message: "Usuario no encontrado" });
//     }

//     res.json({ user });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// module.exports = router;