
const express = require("express");
const { Pool } = require("pg");
const path = require("path");

// Load environment variables from the project root .env file
require("dotenv").config({
    path: path.resolve(__dirname, "../../.env")
});

const app = express();
app.use(express.json());

const PORT = 3001;

// Check whether the database password is available
const DB_PASSWORD = process.env.AZURE_DB_PASSWORD;

if (!DB_PASSWORD) {
    console.error("AZURE_DB_PASSWORD is missing from the root .env file");
    process.exit(1);
}

// Connect to Azure PostgreSQL (local simulation)
const pool = new Pool({
    user: "azure_user",
    host: "localhost",
    database: "azure_library",
    password: DB_PASSWORD,
    port: 5433
});

// Health check
app.get("/health", (req, res) => {
    res.json({
        service: "Book Service",
        status: "healthy"
    });
});

// Get all books from PostgreSQL
app.get("/books", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM books ORDER BY id"
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Database error:", error.message);
        res.status(500).json({
            error: "Unable to fetch books"
        });
    }
});

// Get a book by ID
app.get("/books/:id", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM books WHERE id = $1",
            [Number(req.params.id)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Book not found"
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Database error:", error.message);
        res.status(500).json({
            error: "Unable to fetch book"
        });
    }
});

// Add a new book
app.post("/books", async (req, res) => {
    try {
        const { id, title, author, available } = req.body;

        if (!id || !title || !author) {
            return res.status(400).json({
                error: "id, title and author are required"
            });
        }

        const result = await pool.query(
            `INSERT INTO books (id, title, author, available)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [id, title, author, available ?? true]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Database error:", error.message);
        res.status(500).json({
            error: "Unable to add book"
        });
    }
});

app.listen(PORT, () => {
    console.log(`Book Service running on port ${PORT}`);
});
