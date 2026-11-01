
const express = require("express");
const { Pool } = require("pg");
const path = require("path");

// Load environment variables from the project root .env file
require("dotenv").config({
    path: path.resolve(__dirname, "../../.env")
});

const app = express();
app.use(express.json());

const PORT = 3003;

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
        service: "Member Service",
        status: "healthy"
    });
});

// Get all members
app.get("/members", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM members ORDER BY id"
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            error: "Unable to fetch members"
        });
    }
});

// Get member by ID
app.get("/members/:id", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM members WHERE id = $1",
            [Number(req.params.id)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Member not found"
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            error: "Unable to fetch member"
        });
    }
});

// Add a new member
app.post("/members", async (req, res) => {
    try {
        const { id, name, email } = req.body;

        if (!id || !name || !email) {
            return res.status(400).json({
                error: "id, name and email are required"
            });
        }

        const result = await pool.query(
            `INSERT INTO members (id, name, email)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [id, name, email]
        );

        res.status(201).json(result.rows[0]);

    } catch (error) {
        console.error(error.message);

        if (error.code === "23505") {
            return res.status(409).json({
                error: "Member ID or email already exists"
            });
        }

        res.status(500).json({
            error: "Unable to add member"
        });
    }
});

app.listen(PORT, () => {
    console.log(`Member Service running on port ${PORT}`);
});
