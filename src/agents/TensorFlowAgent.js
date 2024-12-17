// src/agents/TensorFlowAgent.js
const tf = require('@tensorflow/tfjs');
require('@tensorflow/tfjs-node');
const mongoose = require('mongoose');
const Reservation = require('../models/Reservation');

class TensorFlowAgent {
    constructor() {
        this.model = null;
        this.initialized = false;
    }

    async initialize() {
        try {
            this.model = tf.sequential();

            this.model.add(tf.layers.dense({
                units: 64,
                activation: 'relu',
                inputShape: [7] // number of features
            }));

            this.model.add(tf.layers.dense({
                units: 32,
                activation: 'relu'
            }));

            this.model.add(tf.layers.dense({
                units: 1
            }));

            this.model.compile({
                optimizer: 'adam',
                loss: 'meanSquaredError'
            });

            this.initialized = true;
            console.log('AI Model initialized');
        } catch (error) {
            console.error('Error initializing model:', error);
            throw error;
        }
    }

    async analyzeReservation(reservation) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            const seasonalData = await this.getHistoricalSeasonalData(new Date(reservation.start));
            const occupancyData = await this.getCurrentOccupancy(new Date(reservation.start));

            const analysis = {
                predictions: {
                    price: await this.predictPrice(reservation),
                    occupancy: await this.predictOccupancy(reservation)
                },
                historical: {
                    seasonal: seasonalData,
                    occupancy: occupancyData
                },
                recommendations: this.generateRecommendations(reservation)
            };

            return analysis;
        } catch (error) {
            console.error('Error in analyzeReservation:', error);
            return {
                error: 'Error analyzing reservation',
                details: error.message
            };
        }
    }

    async getHistoricalSeasonalData(date) {
        try {
            const month = date.getMonth();
            const startOfMonth = new Date(date.getFullYear(), month - 1, 1);
            const endOfMonth = new Date(date.getFullYear(), month, 0);

            const historicalData = await Reservation.aggregate([
                {
                    $match: {
                        start: { $gte: startOfMonth, $lte: endOfMonth }
                    }
                },
                {
                    $group: {
                        _id: { $dayOfWeek: "$start" },
                        averagePrice: { $avg: "$precioTotal" },
                        count: { $sum: 1 }
                    }
                }
            ]);

            return {
                averagePrices: historicalData,
                seasonType: this.getSeasonType(month),
                occupancyRate: await this.getHistoricalOccupancy(startOfMonth, endOfMonth)
            };
        } catch (error) {
            console.error('Error getting historical seasonal data:', error);
            return {
                averagePrices: [],
                seasonType: 'unknown',
                occupancyRate: 0
            };
        }
    }

    getSeasonType(month) {
        if ([12, 1, 2].includes(month)) return 'high'; // Verano
        if ([6, 7, 8].includes(month)) return 'low';   // Invierno
        return 'medium';                               // Resto del año
    }

    async getCurrentOccupancy(date) {
        try {
            const startOfDay = new Date(date.setHours(0, 0, 0, 0));
            const endOfDay = new Date(date.setHours(23, 59, 59, 999));

            const reservations = await Reservation.countDocuments({
                start: { $lte: endOfDay },
                end: { $gte: startOfDay }
            });

            return {
                date: date,
                occupancyRate: reservations / 20, // Asumiendo 20 habitaciones totales
                reservationCount: reservations
            };
        } catch (error) {
            console.error('Error getting current occupancy:', error);
            return {
                date: date,
                occupancyRate: 0,
                reservationCount: 0
            };
        }
    }

    async predictPrice(reservation) {
        try {
            const features = this.extractFeatures(reservation);
            const prediction = await this.model.predict(tf.tensor2d([features]));
            const price = await prediction.data();

            return {
                predictedPrice: Math.round(price[0]),
                confidence: 0.8, // Placeholder for now
                factors: this.explainPrediction(features)
            };
        } catch (error) {
            console.error('Error predicting price:', error);
            return null;
        }
    }

    async predictOccupancy(reservation) {
        const date = new Date(reservation.start);
        const currentOccupancy = await this.getCurrentOccupancy(date);

        return {
            predicted: currentOccupancy.occupancyRate,
            confidence: 0.7,
            trend: this.getSeasonType(date.getMonth()) === 'high' ? 'increasing' : 'stable'
        };
    }

    extractFeatures(reservation) {
        const start = new Date(reservation.start);
        return [
            this.encodeRoomType(reservation.roomType),
            reservation.numberOfGuests / 4,
            this.calculateStayDuration(reservation) / 30,
            start.getDay() / 6,
            start.getMonth() / 11,
            this.isWeekend(start) ? 1 : 0,
            this.isHighSeason(start) ? 1 : 0
        ];
    }

    generateRecommendations(reservation) {
        const start = new Date(reservation.start);
        return {
            pricing: this.getPricingRecommendations(reservation),
            timing: this.getTimingRecommendations(start),
            upsell: this.getUpsellRecommendations(reservation)
        };
    }

    getPricingRecommendations(reservation) {
        const basePrice = reservation.precioTotal || 0;
        const seasonFactor = this.isHighSeason(new Date(reservation.start)) ? 1.2 : 1.0;

        return {
            minimumRecommended: Math.round(basePrice * 0.9 * seasonFactor),
            maximumRecommended: Math.round(basePrice * 1.2 * seasonFactor),
            adjustmentReason: this.isHighSeason(new Date(reservation.start)) ?
                'Alta temporada' : 'Precio base estándar'
        };
    }

    getTimingRecommendations(date) {
        const hour = date.getHours();
        return {
            checkIn: hour < 12 ? 'Ofrecer early check-in' : 'Horario estándar',
            checkOut: this.isWeekend(date) ? 'Considerar late check-out' : 'Horario estándar'
        };
    }

    getUpsellRecommendations(reservation) {
        const recommendations = [];

        if (reservation.roomType === 'doble') {
            recommendations.push({
                type: 'upgrade',
                to: 'triple',
                benefit: 'Más espacio para su comodidad',
                suggestedIncrease: '30%'
            });
        }

        return recommendations;
    }

    // Utility functions
    encodeRoomType(roomType) {
        const types = {
            'individual': 0,
            'doble': 0.33,
            'triple': 0.66,
            'suite': 1
        };
        return types[roomType] || 0;
    }

    calculateStayDuration(reservation) {
        const start = new Date(reservation.start);
        const end = new Date(reservation.end);
        return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    }

    isWeekend(date) {
        const day = date.getDay();
        return day === 0 || day === 6;
    }

    isHighSeason(date) {
        const month = date.getMonth();
        return [1, 2, 7, 12].includes(month);
    }

    async getHistoricalOccupancy(startDate, endDate) {
        try {
            const reservations = await Reservation.countDocuments({
                start: { $gte: startDate, $lte: endDate }
            });

            const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
            return reservations / (totalDays * 20); // 20 rooms total
        } catch (error) {
            console.error('Error getting historical occupancy:', error);
            return 0;
        }
    }

    explainPrediction(features) {
        return {
            roomType: features[0],
            occupancy: features[1],
            duration: features[2],
            seasonality: features[4],
            weekendEffect: features[5]
        };
    }
}

module.exports = TensorFlowAgent;