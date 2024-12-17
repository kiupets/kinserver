// src/agents/LightAIAgent.js
const mongoose = require('mongoose');
const Reservation = require('../models/Reservation');

class LightAIAgent {
    constructor() {
        this.weights = {
            season: 0.3,
            dayOfWeek: 0.2,
            historicalDemand: 0.3,
            specialEvents: 0.2
        };

        this.learningRate = 0.01;
        this.trainingData = [];
    }

    // Sistema de aprendizaje simple
    learn(input, actualOutput) {
        this.trainingData.push({ input, actualOutput });
        this.updateWeights(input, actualOutput);
    }

    updateWeights(input, actualOutput) {
        const prediction = this.predict(input);
        const error = actualOutput - prediction;

        Object.keys(this.weights).forEach(feature => {
            const adjustment = error * this.learningRate * input[feature];
            this.weights[feature] += adjustment;
        });
    }

    // Predicción usando pesos aprendidos
    predict(input) {
        return Object.keys(this.weights).reduce((sum, feature) => {
            return sum + (input[feature] * this.weights[feature]);
        }, 0);
    }

    // Análisis de patrones
    async analyzePatterns(userId) {
        const reservations = await this.getReservationHistory(userId);
        const patterns = {
            seasonality: this.analyzeSeasonality(reservations),
            weekdayPreference: this.analyzeWeekdayPreference(reservations),
            stayDuration: this.analyzeStayDuration(reservations),
            pricePatterns: this.analyzePricePatterns(reservations)
        };

        return patterns;
    }

    async getReservationHistory(userId) {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        return await Reservation.find({
            user: userId,
            start: { $gte: sixMonthsAgo }
        }).sort({ start: 1 });
    }

    // Análisis de estacionalidad
    analyzeSeasonality(reservations) {
        const seasonalDistribution = reservations.reduce((acc, res) => {
            const month = new Date(res.start).getMonth();
            const season = this.getSeason(month);
            acc[season] = (acc[season] || 0) + 1;
            return acc;
        }, {});

        const total = reservations.length;
        return Object.keys(seasonalDistribution).reduce((acc, season) => {
            acc[season] = seasonalDistribution[season] / total;
            return acc;
        }, {});
    }

    // Análisis de preferencia por días de la semana
    analyzeWeekdayPreference(reservations) {
        const weekdayDistribution = reservations.reduce((acc, res) => {
            const day = new Date(res.start).getDay();
            acc[day] = (acc[day] || 0) + 1;
            return acc;
        }, {});

        const total = reservations.length;
        return Object.keys(weekdayDistribution).reduce((acc, day) => {
            acc[day] = weekdayDistribution[day] / total;
            return acc;
        }, {});
    }

    // Análisis de duración de estadía
    analyzeStayDuration(reservations) {
        const durations = reservations.map(res => {
            const start = new Date(res.start);
            const end = new Date(res.end);
            return (end - start) / (1000 * 60 * 60 * 24); // días
        });

        return {
            average: this.average(durations),
            median: this.median(durations),
            mostCommon: this.mode(durations)
        };
    }

    // Análisis de patrones de precios
    analyzePricePatterns(reservations) {
        const prices = reservations.map(res => res.precioTotal);

        return {
            average: this.average(prices),
            median: this.median(prices),
            trend: this.calculatePriceTrend(prices)
        };
    }

    // Predicción de demanda
    async predictDemand(date, roomType) {
        const input = {
            season: this.seasonWeight(date),
            dayOfWeek: this.dayWeight(date),
            historicalDemand: await this.getHistoricalDemand(date),
            specialEvents: await this.checkSpecialEvents(date)
        };

        const demandScore = this.predict(input);
        return {
            predictedDemand: this.normalizeDemand(demandScore),
            confidence: this.calculateConfidence(input)
        };
    }

    // Recomendación de precios
    async recommendPrice(date, roomType, basePrice) {
        const demand = await this.predictDemand(date, roomType);
        const seasonalFactor = this.getSeasonalFactor(date);
        const historicalPerformance = await this.getHistoricalPerformance(date, roomType);

        const recommendedPrice = basePrice * (
            1 +
            (demand.predictedDemand - 0.5) * 0.2 + // Ajuste por demanda
            (seasonalFactor - 1) + // Ajuste estacional
            (historicalPerformance.profitMargin - 0.15) // Ajuste por rendimiento histórico
        );

        return {
            price: Math.round(recommendedPrice),
            factors: {
                demand: demand.predictedDemand,
                seasonality: seasonalFactor,
                historicalPerformance: historicalPerformance
            }
        };
    }

    // Funciones auxiliares
    getSeason(month) {
        if ([11, 0, 1].includes(month)) return 'winter';
        if ([2, 3, 4].includes(month)) return 'spring';
        if ([5, 6, 7].includes(month)) return 'summer';
        return 'fall';
    }

    average(numbers) {
        return numbers.reduce((a, b) => a + b, 0) / numbers.length;
    }

    median(numbers) {
        const sorted = [...numbers].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    mode(numbers) {
        const frequency = {};
        let maxFreq = 0;
        let mode = null;

        numbers.forEach(num => {
            frequency[num] = (frequency[num] || 0) + 1;
            if (frequency[num] > maxFreq) {
                maxFreq = frequency[num];
                mode = num;
            }
        });

        return mode;
    }

    calculatePriceTrend(prices) {
        if (prices.length < 2) return 0;

        const changes = [];
        for (let i = 1; i < prices.length; i++) {
            changes.push((prices[i] - prices[i - 1]) / prices[i - 1]);
        }

        return this.average(changes);
    }

    calculateConfidence(input) {
        // Calcula la confianza basada en la cantidad y calidad de los datos
        const dataPoints = this.trainingData.length;
        const consistency = this.calculateConsistency();
        return Math.min(0.9, (dataPoints / 100) * consistency);
    }

    calculateConsistency() {
        if (this.trainingData.length < 2) return 0.5;

        const predictions = this.trainingData.map(data =>
            Math.abs(this.predict(data.input) - data.actualOutput)
        );

        const averageError = this.average(predictions);
        return 1 - Math.min(averageError, 1);
    }
}

module.exports = LightAIAgent;