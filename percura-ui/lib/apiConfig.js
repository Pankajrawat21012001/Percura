/**
 * API Configuration
 * 
 * In production: API is served from the same origin (relative URLs)
 * In development: API is at localhost:3001
 * 
 * Override via NEXT_PUBLIC_API_URL environment variable if needed.
 */

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
        ? ''
        : 'http://localhost:3001');

export default API_BASE_URL;
