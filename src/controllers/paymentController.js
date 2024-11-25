const createReservation = async (req, res) => {
    const { reservationData } = req.body;

    // Extract payment details
    const { payments } = reservationData;

    // Process each payment
    payments.forEach(payment => {
        console.log(`Payment Method: ${payment.method}, Amount: ${payment.amount}`);
        // Here you can implement logic to save each payment method and amount
        // For example, save to the database
    });

    // Continue with the rest of the reservation creation logic
    // ...
}; 