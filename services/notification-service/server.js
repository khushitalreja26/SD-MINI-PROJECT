
const express = require("express");
const { Pool } = require("pg");
const path = require("path");

// Load environment variables from the project root .env file
require("dotenv").config({
    path: path.resolve(__dirname, "../../.env")
});

const app = express();
app.use(express.json());

const PORT = 3004;

// Check whether the database password is available
const DB_PASSWORD = process.env.RENDER_DB_PASSWORD;

if (!DB_PASSWORD) {
    console.error("RENDER_DB_PASSWORD is missing from the root .env file");
    process.exit(1);
}

// Connect to Render PostgreSQL (local simulation)
const pool = new Pool({
    user: "render_user",
    host: "localhost",
    database: "render_library",
    password: DB_PASSWORD,
    port: 5434
});

// Health check
app.get("/health", (req, res) => {
    res.json({
        service: "Notification Service",
        status: "healthy"
    });
});

// Get all notifications
app.get("/notifications", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM notifications ORDER BY id"
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            error: "Unable to fetch notifications"
        });
    }
});

// Send a notification
app.post("/notifications", async (req, res) => {
    try {
        const { memberId, message } = req.body;

        if (!memberId || !message) {
            return res.status(400).json({
                error: "memberId and message are required"
            });
        }

        const result = await pool.query(
            `INSERT INTO notifications (member_id, message, status)
             VALUES ($1, $2, 'Sent')
             RETURNING *`,
            [memberId, message]
        );

        res.status(201).json({
            message: "Notification sent successfully",
            notification: result.rows[0]
        });

    } catch (error) {
        console.error(error.message);

        if (error.code === "23503") {
            return res.status(404).json({
                error: "Member does not exist"
            });
        }

        res.status(500).json({
            error: "Unable to send notification"
        });
    }
});

app.listen(PORT, () => {
    console.log(`Notification Service running on port ${PORT}`);
});
