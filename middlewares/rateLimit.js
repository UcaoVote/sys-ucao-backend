const rateLimit = (options) => {
    const requests = new Map();

    return (req, res, next) => {
        const ip = req.ip;
        const now = Date.now();
        const windowMs = options.windowMs || 15 * 60 * 1000;
        const max = options.max || 5;

        const entry = requests.get(ip) || { count: 0, startTime: now };

        if (now - entry.startTime > windowMs) {
            requests.set(ip, { count: 1, startTime: now });
            return next();
        }

        if (entry.count >= max) {
            console.error('Rate limit exceeded', { ip });
            return res.status(429).json({
                success: false,
                message: 'Trop de tentatives. Réessayez plus tard.'
            });
        }

        entry.count++;
        requests.set(ip, entry);
        next();
    };
};

export { rateLimit };