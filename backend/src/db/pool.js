const { Pool } = require('pg');
const net = require('net');

// Deep monkey-patch Node's networking to absolutely force IPv4.
// Node 20+ Happy Eyeballs races IPv6/IPv4, and when IPv6 throws ENETUNREACH, 
// it aborts the entire TCP handshake causing sporadic ETIMEDOUT on NeonDB.
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
    if (typeof args[0] === 'object' && args[0] !== null) {
        args[0].family = 4;
    } else if (typeof args[1] === 'string') {
        // signature: connect(port, host, listener)
        // host is the second argument
        // We can't easily force family here without converting to options object
        const port = args[0];
        const host = args[1];
        const listener = typeof args[2] === 'function' ? args[2] : undefined;
        return originalConnect.call(this, { port, host, family: 4 }, listener);
    }
    return originalConnect.apply(this, args);
};

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle DB client (NeonDB may have closed it)', err.message);
});

const query = (text, params) => pool.query(text, params);
const getClient = () => pool.connect();

module.exports = { pool, query, getClient };
