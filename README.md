# Library Management System

This project is a real database-driven library management system built with:

- Frontend: HTML + Tailwind CSS + vanilla JavaScript
- Backend: Node.js + Express
- Database: MySQL

## Features

- Add books with `title` and `author`
- Issue books to a user
- Return issued books
- Delete books from the database
- Prevent deletion of currently issued books
- Update tables instantly without page reload
- Show live MySQL connection status on screen

## Project Structure

```text
.
|-- public/
|   |-- app.js
|   `-- index.html
|-- db.js
|-- package.json
|-- README.md
|-- schema.sql
`-- server.js
```

## Setup

1. Create a MySQL database using [schema.sql](/C:/Users/HP/Documents/New%20project/schema.sql).
2. Copy `.env.example` to `.env`.
3. Update the MySQL username, password, and database name in `.env`.
4. Install packages:

```bash
npm install
```

5. Start the project:

```bash
npm run dev
```

6. Open:

```text
http://localhost:3000
```

## Database Logic

- `books.status = 'available'` means the book can be issued.
- `books.status = 'issued'` means the book is currently assigned to a user.
- `issues.returned_at IS NULL` means the book is still issued.
- Returning a book updates both the `issues` row and the `books` row.
- Deleting a book removes it from MySQL, not just from the screen.

## Important Note

This environment did not allow package download during this turn, so the dependency install step was prepared in `package.json` but not executed here.
