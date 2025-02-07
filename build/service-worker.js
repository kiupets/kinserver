self.addEventListener('push', function (event) {
    const options = {
        body: event.data.text(),
        icon: 'logo192.png',
        badge: 'logo192.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: '1'
        }
    };

    event.waitUntil(
        self.registration.showNotification('KinHotel', options)
    );
}); 