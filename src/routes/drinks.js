// src/routes/drinks.js
const express = require('express');
const router = express.Router();
const Drink = require('../models/Drink');

// Get all drinks
router.get("/", async (req, res) => {
    try {
        const drinks = await Drink.find();
        res.status(200).json(drinks);
    } catch (error) {
        console.error("Error fetching drinks:", error);
        res.status(500).json({ error: error.message });
    }
});

// Create new drink
router.post("/", async (req, res) => {
    try {
        const { name, quantity, price, category } = req.body;
        const newDrink = new Drink({
            name,
            quantity,
            price,
            category,
            lastUpdated: new Date()
        });
        await newDrink.save();
        res.status(201).json(newDrink);
    } catch (error) {
        console.error("Error creating drink:", error);
        res.status(500).json({ error: error.message });
    }
});

// Update drink
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { name, quantity, price, category } = req.body;
        const updatedDrink = await Drink.findByIdAndUpdate(
            id,
            {
                name,
                quantity,
                price,
                category,
                lastUpdated: new Date()
            },
            { new: true }
        );
        res.status(200).json(updatedDrink);
    } catch (error) {
        console.error("Error updating drink:", error);
        res.status(500).json({ error: error.message });
    }
});

// Delete drink
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await Drink.findByIdAndDelete(id);
        res.status(200).json({ message: "Drink deleted successfully" });
    } catch (error) {
        console.error("Error deleting drink:", error);
        res.status(500).json({ error: error.message });
    }
});

// Update drink quantity
router.patch("/:id/quantity", async (req, res) => {
    try {
        const { id } = req.params;
        const { quantity } = req.body;
        const updatedDrink = await Drink.findByIdAndUpdate(
            id,
            {
                quantity,
                lastUpdated: new Date()
            },
            { new: true }
        );
        res.status(200).json(updatedDrink);
    } catch (error) {
        console.error("Error updating drink quantity:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;