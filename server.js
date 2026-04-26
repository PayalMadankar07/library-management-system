const express = require("express");
const path = require("path");
const pool = require("./db");

require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function getErrorMessage(error) {
  if (!error) {
    return "Unknown error.";
  }

  if (error.message) {
    return error.message;
  }

  if (Array.isArray(error.errors) && error.errors.length > 0) {
    return error.errors
      .map((entry) => entry.message || `${entry.code || "ERROR"} while connecting`)
      .join(" | ");
  }

  if (error.code) {
    return error.code;
  }

  return "Unexpected server error.";
}

function normalizeBook(row) {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    status: row.status,
    issuedTo: row.issued_to,
    activeIssueId: row.active_issue_id,
    createdAt: row.created_at
  };
}

function normalizeIssue(row) {
  return {
    id: row.id,
    bookId: row.book_id,
    title: row.title,
    author: row.author,
    issuedTo: row.issued_to,
    issuedAt: row.issued_at,
    returnedAt: row.returned_at,
    status: row.returned_at ? "returned" : "issued"
  };
}

async function fetchBooks() {
  const [rows] = await pool.query(
    `SELECT
      b.id,
      b.title,
      b.author,
      b.status,
      b.created_at,
      i.id AS active_issue_id,
      i.issued_to
    FROM books b
    LEFT JOIN issues i
      ON i.book_id = b.id
      AND i.returned_at IS NULL
    ORDER BY
      CASE b.status WHEN 'issued' THEN 0 ELSE 1 END,
      b.title ASC,
      b.id DESC`
  );

  return rows.map(normalizeBook);
}

async function fetchIssues() {
  const [rows] = await pool.query(
    `SELECT
      i.id,
      i.book_id,
      i.issued_to,
      i.issued_at,
      i.returned_at,
      b.title,
      b.author
    FROM issues i
    INNER JOIN books b ON b.id = i.book_id
    ORDER BY
      CASE WHEN i.returned_at IS NULL THEN 0 ELSE 1 END,
      i.issued_at DESC,
      i.id DESC`
  );

  return rows.map(normalizeIssue);
}

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, message: "Database connection is working." });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Database connection failed.",
      error: getErrorMessage(error)
    });
  }
});

app.get("/api/dashboard", async (_req, res) => {
  try {
    const [books, issues] = await Promise.all([fetchBooks(), fetchIssues()]);

    const summary = {
      totalBooks: books.length,
      availableBooks: books.filter((book) => book.status === "available").length,
      issuedBooks: books.filter((book) => book.status === "issued").length,
      totalTransactions: issues.length
    };

    res.json({ summary, books, issues });
  } catch (error) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
});

app.post("/api/books", async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();
    const author = String(req.body.author || "").trim();

    if (!title || !author) {
      return res.status(400).json({ message: "Title and author are required." });
    }

    const [result] = await pool.query(
      "INSERT INTO books (title, author, status) VALUES (?, ?, 'available')",
      [title, author]
    );

    const [rows] = await pool.query("SELECT * FROM books WHERE id = ?", [result.insertId]);
    res.status(201).json({ message: "Book added successfully.", book: rows[0] });
  } catch (error) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
});

app.post("/api/issues", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const bookId = Number(req.body.bookId);
    const issuedTo = String(req.body.issuedTo || "").trim();

    if (!bookId || !issuedTo) {
      return res.status(400).json({ message: "Book and user name are required." });
    }

    await connection.beginTransaction();

    const [bookRows] = await connection.query("SELECT * FROM books WHERE id = ? FOR UPDATE", [bookId]);
    const book = bookRows[0];

    if (!book) {
      await connection.rollback();
      return res.status(404).json({ message: "Book not found." });
    }

    if (book.status === "issued") {
      await connection.rollback();
      return res.status(409).json({ message: "This book is already issued." });
    }

    await connection.query(
      "INSERT INTO issues (book_id, issued_to, issued_at) VALUES (?, ?, NOW())",
      [bookId, issuedTo]
    );

    await connection.query(
      "UPDATE books SET status = 'issued', updated_at = NOW() WHERE id = ?",
      [bookId]
    );

    await connection.commit();
    res.status(201).json({ message: "Book issued successfully." });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
});

app.patch("/api/issues/:id/return", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const issueId = Number(req.params.id);

    await connection.beginTransaction();

    const [issueRows] = await connection.query(
      "SELECT * FROM issues WHERE id = ? FOR UPDATE",
      [issueId]
    );
    const issue = issueRows[0];

    if (!issue) {
      await connection.rollback();
      return res.status(404).json({ message: "Issue record not found." });
    }

    if (issue.returned_at) {
      await connection.rollback();
      return res.status(409).json({ message: "This book is already returned." });
    }

    await connection.query(
      "UPDATE issues SET returned_at = NOW() WHERE id = ?",
      [issueId]
    );

    await connection.query(
      "UPDATE books SET status = 'available', updated_at = NOW() WHERE id = ?",
      [issue.book_id]
    );

    await connection.commit();
    res.json({ message: "Book returned successfully." });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
});

app.delete("/api/books/:id", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const bookId = Number(req.params.id);

    await connection.beginTransaction();

    const [bookRows] = await connection.query("SELECT * FROM books WHERE id = ? FOR UPDATE", [bookId]);
    const book = bookRows[0];

    if (!book) {
      await connection.rollback();
      return res.status(404).json({ message: "Book not found." });
    }

    if (book.status === "issued") {
      await connection.rollback();
      return res.status(409).json({
        message: "Issued books cannot be deleted. Return the book first."
      });
    }

    await connection.query("DELETE FROM issues WHERE book_id = ?", [bookId]);
    await connection.query("DELETE FROM books WHERE id = ?", [bookId]);

    await connection.commit();
    res.json({ message: "Book deleted from database successfully." });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Library Management System running on http://localhost:${PORT}`);
});
