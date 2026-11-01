
const express = require("express");
const { Pool } = require("pg");
const path = require("path");

// Load environment variables from the project root .env file
require("dotenv").config({
    path: path.resolve(__dirname, "../../.env")
});

const app = express();
app.use(express.json());

const PORT = 3002;

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
        service: "Borrow Service",
        status: "healthy"
    });
});

// Get all borrowing records
app.get("/borrows", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM borrow_records ORDER BY id"
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: "Unable to fetch records" });
    }
});

// Borrow a book
app.post("/borrows", async (req, res) => {
    const { memberId, bookId } = req.body;
    const client = await pool.connect();

    try {
        if (!memberId || !bookId) {
            return res.status(400).json({
                error: "memberId and bookId are required"
            });
        }

        await client.query("BEGIN");

        const bookResult = await client.query(
            "SELECT * FROM books WHERE id = $1 FOR UPDATE",
            [bookId]
        );

        if (bookResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Book not found" });
        }

        if (!bookResult.rows[0].available) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                error: "Book is not available"
            });
        }

        const borrowResult = await client.query(
            `INSERT INTO borrow_records (member_id, book_id, status)
             VALUES ($1, $2, 'Borrowed')
             RETURNING *`,
            [memberId, bookId]
        );

        await client.query(
            "UPDATE books SET available = FALSE WHERE id = $1",
            [bookId]
        );

        await client.query("COMMIT");

        res.status(201).json({
            message: "Book borrowed successfully",
            record: borrowResult.rows[0]
        });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error(error.message);
        res.status(500).json({ error: "Unable to borrow book" });
    } finally {
        client.release();
    }
});

// Return a book
app.put("/borrows/:id/return", async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            "SELECT * FROM borrow_records WHERE id = $1 FOR UPDATE",
            [Number(req.params.id)]
        );

        if (result.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({
                error: "Borrow record not found"
            });
        }

        const record = result.rows[0];

        if (record.status === "Returned") {
            await client.query("ROLLBACK");
            return res.status(400).json({
                error: "Book has already been returned"
            });
        }

        await client.query(
            "UPDATE borrow_records SET status = 'Returned' WHERE id = $1",
            [record.id]
        );

        await client.query(
            "UPDATE books SET available = TRUE WHERE id = $1",
            [record.book_id]
        );

        await client.query("COMMIT");

        res.json({
            message: "Book returned successfully",
            record: { ...record, status: "Returned" }
        });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error(error.message);
        res.status(500).json({ error: "Unable to return book" });
    } finally {
        client.release();
    }
});

app.listen(PORT, () => {
    console.log(`Borrow Service running on port ${PORT}`);
});
