const express = require('express');
const router = express.Router();
const Guest = require('../models/Guest');
const Reservation = require('../models/Reservation'); // Agregamos import de Reservation
const mongoose = require('mongoose');

// Middleware to validate userId
const validateUserId = (req, res, next) => {
    const userId = req.query.userId || req.body.userId;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'ID de usuario inválido' });
    }
    next();
};

// Get all guests or search by query
router.get("/", validateUserId, async (req, res) => {
    const { name, surname, phone, email, dni, userId, page = 1, limit = 10 } = req.query;

    try {
        const query = { user: userId };

        // Si hay un término de búsqueda, buscar en múltiples campos
        if (name || surname || dni) {
            const searchTerm = name || surname || dni;
            query.$or = [
                { name: { $regex: searchTerm, $options: 'i' } },
                { surname: { $regex: searchTerm, $options: 'i' } },
                { dni: { $regex: searchTerm, $options: 'i' } }
            ];
        }

        // Búsqueda en la colección Guest
        const guestsFromGuestCollection = await Guest.find(query)
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(); // Usamos lean() para obtener objetos JS planos

        // Búsqueda en la colección Reservation
        const guestsFromReservations = await Reservation.find(query)
            .select('name surname phone email dni createdAt start end room billingStatus')
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        // Combinar resultados y eliminar duplicados por DNI, manteniendo los datos de reserva
        const combinedGuests = [...guestsFromGuestCollection, ...guestsFromReservations];
        const uniqueGuests = Array.from(
            combinedGuests.reduce((map, guest) => {
                if (!map.has(guest.dni)) {
                    map.set(guest.dni, guest);
                } else {
                    // Si ya existe, mantener los datos de reserva si están presentes
                    const existingGuest = map.get(guest.dni);
                    if (guest.start && guest.end && guest.room) {
                        map.set(guest.dni, {
                            ...existingGuest,
                            start: guest.start,
                            end: guest.end,
                            room: guest.room,
                            billingStatus: guest.billingStatus
                        });
                    }
                }
                return map;
            }, new Map()).values()
        );

        // Ordenar por fecha de creación
        uniqueGuests.sort((a, b) => b.createdAt - a.createdAt);

        // Aplicar paginación al resultado combinado
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedGuests = uniqueGuests.slice(startIndex, endIndex);

        // Contar total de resultados únicos
        const totalGuestsInGuest = await Guest.countDocuments(query);
        const totalGuestsInReservation = await Reservation.countDocuments(query);
        const totalUniqueGuests = new Set([...guestsFromGuestCollection.map(g => g.dni),
        ...guestsFromReservations.map(g => g.dni)]).size;

        res.status(200).json({
            guests: paginatedGuests,
            totalPages: Math.ceil(totalUniqueGuests / limit),
            currentPage: parseInt(page),
            totalGuests: totalUniqueGuests
        });
    } catch (error) {
        console.error("Error fetching guests:", error);
        res.status(500).json({ message: 'Error al cargar los huéspedes', error: error.message });
    }
});

// Get a specific guest
router.get('/:id', validateUserId, async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.query;

        // Primero buscar en Guest
        let guest = await Guest.findOne({ _id: id, user: userId });

        // Si no se encuentra en Guest, buscar en Reservation
        if (!guest) {
            guest = await Reservation.findOne({ _id: id, user: userId })
                .select('name surname phone email dni createdAt');
        }

        if (!guest) {
            return res.status(404).json({ message: 'Huésped no encontrado' });
        }
        res.status(200).json(guest);
    } catch (error) {
        console.error("Error fetching guest:", error);
        res.status(500).json({ message: 'Error al cargar el huésped', error: error.message });
    }
});

// Create a new guest
router.post("/", validateUserId, async (req, res) => {
    try {
        const { name, surname, phone, email, dni, userId } = req.body;

        // Validate required fields
        if (!name || !surname || !phone || !email || !dni) {
            return res.status(400).json({ message: 'Todos los campos son requeridos' });
        }

        // Check if guest already exists in either collection
        const existingGuest = await Guest.findOne({ dni, user: userId });
        const existingReservation = await Reservation.findOne({ dni, user: userId });

        if (existingGuest || existingReservation) {
            return res.status(400).json({ message: 'Ya existe un huésped con este DNI' });
        }

        const newGuest = new Guest({
            name,
            surname,
            phone,
            email,
            dni,
            user: userId
        });

        await newGuest.save();
        res.status(201).json(newGuest);
    } catch (error) {
        console.error("Error creating guest:", error);
        res.status(500).json({ message: 'Error al crear el huésped', error: error.message });
    }
});

// Update guest
router.put('/:id', validateUserId, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, surname, phone, email, dni, userId } = req.body;

        // Validate required fields
        if (!name || !surname || !phone || !email || !dni) {
            return res.status(400).json({ message: 'Todos los campos son requeridos' });
        }

        const guest = await Guest.findOneAndUpdate(
            { _id: id, user: userId },
            { name, surname, phone, email, dni },
            { new: true, runValidators: true }
        );

        if (!guest) {
            return res.status(404).json({ message: 'Huésped no encontrado' });
        }

        res.json(guest);
    } catch (error) {
        console.error("Error updating guest:", error);
        res.status(500).json({ message: 'Error al actualizar el huésped', error: error.message });
    }
});

// Delete guest
router.delete('/:id', validateUserId, async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.query;

        const guest = await Guest.findOneAndDelete({ _id: id, user: userId });

        if (!guest) {
            return res.status(404).json({ message: 'Huésped no encontrado' });
        }

        res.json({ message: 'Huésped eliminado correctamente' });
    } catch (error) {
        console.error("Error deleting guest:", error);
        res.status(500).json({ message: 'Error al eliminar el huésped', error: error.message });
    }
});

module.exports = router;