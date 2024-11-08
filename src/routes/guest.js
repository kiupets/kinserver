const express = require('express');
const router = express.Router();
const Guest = require('../models/Guest');

// Get all guests or search by query
router.get("/", async (req, res) => {
    const { name, surname, phone, email, dni } = req.query; // Get query parameters

    try {
        const query = {};
        if (name) query.name = { $regex: name, $options: 'i' }; // Case-insensitive search
        if (surname) query.surname = { $regex: surname, $options: 'i' };
        if (phone) query.phone = { $regex: phone, $options: 'i' };
        if (email) query.email = { $regex: email, $options: 'i' };
        if (dni) query.dni = { $regex: dni, $options: 'i' };

        const guests = await Guest.find(query);
        res.status(200).json(guests);
    } catch (error) {
        console.error("Error fetching guests:", error);
        res.status(500).json({ error: error.message });
    }
});

// Create a new guest
router.post("/", async (req, res) => {
    try {
        const { name, surname, phone, email, dni } = req.body;
        const newGuest = new Guest({
            name,
            surname,
            phone,
            email,
            dni
        });
        await newGuest.save();
        res.status(201).json(newGuest);
    } catch (error) {
        console.error("Error creating guest:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;