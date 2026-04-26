const state = {
  books: [],
  issues: []
};

const elements = {
  summaryCards: document.getElementById("summary-cards"),
  dbStatus: document.getElementById("db-status"),
  bookForm: document.getElementById("book-form"),
  issueForm: document.getElementById("issue-form"),
  issueBook: document.getElementById("issue-book"),
  booksTableBody: document.getElementById("books-table-body"),
  issuesTableBody: document.getElementById("issues-table-body"),
  toast: document.getElementById("toast")
};

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }

  return data;
}

function showToast(message, type = "success") {
  const colors = {
    success: "bg-emerald-500",
    error: "bg-rose-500"
  };

  elements.toast.textContent = message;
  elements.toast.className = `fixed bottom-5 right-5 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${colors[type]}`;
  elements.toast.classList.remove("hidden");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    elements.toast.classList.add("hidden");
  }, 2600);
}

function badgeClasses(status) {
  if (status === "issued") {
    return "bg-orange-100 text-orange-700";
  }

  if (status === "returned") {
    return "bg-slate-200 text-slate-700";
  }

  return "bg-emerald-100 text-emerald-700";
}

function renderSummary(summary) {
  const cards = [
    { label: "Total Books", value: summary.totalBooks, accent: "bg-skyglass" },
    { label: "Available", value: summary.availableBooks, accent: "bg-mint" },
    { label: "Issued", value: summary.issuedBooks, accent: "bg-peach" },
    { label: "Transactions", value: summary.totalTransactions, accent: "bg-slate-200" }
  ];

  elements.summaryCards.innerHTML = cards
    .map(
      (card) => `
        <article class="rounded-[1.75rem] bg-white p-5 shadow-float">
          <div class="inline-flex rounded-2xl ${card.accent} px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-slate-700">
            ${card.label}
          </div>
          <div class="mt-4 text-4xl font-black text-ink">${card.value}</div>
        </article>
      `
    )
    .join("");
}

function renderIssueOptions() {
  const availableBooks = state.books.filter((book) => book.status === "available");

  elements.issueBook.innerHTML = `
    <option value="">Choose available book</option>
    ${availableBooks
      .map(
        (book) =>
          `<option value="${book.id}">${book.title} by ${book.author}</option>`
      )
      .join("")}
  `;
}

function renderBooks() {
  if (!state.books.length) {
    elements.booksTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="px-4 py-6 text-center text-slate-500">No books added yet.</td>
      </tr>
    `;
    return;
  }

  elements.booksTableBody.innerHTML = state.books
    .map(
      (book) => `
        <tr class="align-top">
          <td class="px-4 py-4 font-semibold text-slate-500">${book.id}</td>
          <td class="px-4 py-4">
            <div class="font-semibold text-slate-800">${book.title}</div>
          </td>
          <td class="px-4 py-4 text-slate-600">${book.author}</td>
          <td class="px-4 py-4">
            <span class="inline-flex rounded-full px-3 py-1 text-xs font-bold ${badgeClasses(book.status)}">
              ${book.status}
            </span>
          </td>
          <td class="px-4 py-4 text-slate-600">${book.issuedTo || "-"}</td>
          <td class="px-4 py-4">
            <button
              data-book-delete="${book.id}"
              class="rounded-xl px-3 py-2 text-xs font-semibold text-white ${
                book.status === "issued" ? "bg-slate-300 cursor-not-allowed" : "bg-rose-500 hover:bg-rose-600"
              }"
              ${book.status === "issued" ? "disabled" : ""}
            >
              Delete
            </button>
          </td>
        </tr>
      `
    )
    .join("");
}

function renderIssues() {
  if (!state.issues.length) {
    elements.issuesTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="px-4 py-6 text-center text-slate-500">No issue activity yet.</td>
      </tr>
    `;
    return;
  }

  elements.issuesTableBody.innerHTML = state.issues
    .map(
      (issue) => `
        <tr class="align-top">
          <td class="px-4 py-4">
            <div class="font-semibold text-slate-800">${issue.title}</div>
            <div class="text-xs text-slate-500">${issue.author}</div>
          </td>
          <td class="px-4 py-4 text-slate-600">${issue.issuedTo}</td>
          <td class="px-4 py-4">
            <span class="inline-flex rounded-full px-3 py-1 text-xs font-bold ${badgeClasses(issue.status)}">
              ${issue.status}
            </span>
          </td>
          <td class="px-4 py-4">
            ${
              issue.status === "issued"
                ? `<button data-return-id="${issue.id}" class="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600">Return</button>`
                : `<span class="text-xs font-semibold text-slate-400">Completed</span>`
            }
          </td>
        </tr>
      `
    )
    .join("");
}

function renderAll(summary) {
  renderSummary(summary);
  renderIssueOptions();
  renderBooks();
  renderIssues();
}

async function loadDashboard() {
  const data = await request("/api/dashboard");
  state.books = data.books;
  state.issues = data.issues;
  renderAll(data.summary);
}

async function checkHealth() {
  try {
    const data = await request("/api/health");
    elements.dbStatus.textContent = data.message;
    elements.dbStatus.className =
      "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700";
  } catch (error) {
    elements.dbStatus.textContent = error.message;
    elements.dbStatus.className =
      "rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700";
  }
}

elements.bookForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;

  const formData = new FormData(form);
  const payload = {
    title: formData.get("title"),
    author: formData.get("author")
  };

  try {
    await request("/api/books", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    form.reset();
    await loadDashboard();
    showToast("Book added to database.");
  } catch (error) {
    showToast(error.message, "error");
  }
});

elements.issueForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;

  const formData = new FormData(form);
  const payload = {
    bookId: formData.get("bookId"),
    issuedTo: formData.get("issuedTo")
  };

  try {
    await request("/api/issues", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    form.reset();
    await loadDashboard();
    showToast("Book issued successfully.");
  } catch (error) {
    showToast(error.message, "error");
  }
});

document.addEventListener("click", async (event) => {
  const returnButton = event.target.closest("[data-return-id]");
  const deleteButton = event.target.closest("[data-book-delete]");

  try {
    if (returnButton) {
      await request(`/api/issues/${returnButton.dataset.returnId}/return`, {
        method: "PATCH"
      });
      await loadDashboard();
      showToast("Book returned successfully.");
    }

    if (deleteButton && !deleteButton.disabled) {
      await request(`/api/books/${deleteButton.dataset.bookDelete}`, {
        method: "DELETE"
      });
      await loadDashboard();
      showToast("Book deleted from database.");
    }
  } catch (error) {
    showToast(error.message, "error");
  }
});

async function init() {
  await checkHealth();
  try {
    await loadDashboard();
  } catch (error) {
    showToast(error.message, "error");
  }
}

init();
