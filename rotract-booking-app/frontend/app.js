const API_URL = "http://127.0.0.1:8000/api/bookings";

// Load bookings as soon as the page opens
document.addEventListener("DOMContentLoaded", loadBookings);

// Handle form submission
document.getElementById("booking-form").addEventListener("submit", async (e) => {
    e.preventDefault(); // Prevent page reload
    
    const messageBox = document.getElementById("message-box");
    
    // Gather form data
    const bookingData = {
        name: document.getElementById("name").value,
        booking_date: document.getElementById("booking_date").value,
        start_time: document.getElementById("start_time").value + ":00", // API expects HH:MM:SS
        end_time: document.getElementById("end_time").value + ":00",
        category: document.getElementById("category").value,
        priority: document.getElementById("priority").value,
        note: document.getElementById("note").value,
        delete_code: document.getElementById("delete_code").value
    };

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bookingData)
        });

        const result = await response.json();

        if (!response.ok) {
            // This catches the 400 Overlap Error
            showMessage(result.detail, "error");
        } else {
            showMessage("Booking successful!", "success");
            document.getElementById("booking-form").reset();
            loadBookings(); // Refresh the list
        }
    } catch (error) {
        showMessage("Server connection failed.", "error");
    }
});

// Fetch and display bookings
async function loadBookings() {
    const filterDate = document.getElementById("filter_date").value;
    const sortBy = document.getElementById("sort_by").value;
    
    let url = `${API_URL}?sort_by=${sortBy}`;
    if (filterDate) {
        url += `&filter_date=${filterDate}`;
    }

    const response = await fetch(url);
    const result = await response.json();
    
    const listContainer = document.getElementById("bookings-list");
    listContainer.innerHTML = ""; // Clear current list

    result.data.forEach(booking => {
        const div = document.createElement("div");
        div.className = "booking-item";
        div.innerHTML = `
            <div>
                <strong>${booking.name}</strong> (${booking.category})
                <br>
                <small>${booking.booking_date} | ${booking.start_time} - ${booking.end_time}</small>
                <br>
                <span class="badge ${booking.priority.toLowerCase()}">${booking.priority}</span>
            </div>
            <button onclick="deleteBooking(${booking.id})" class="delete-btn">X</button>
        `;
        listContainer.appendChild(div);
    });
}

// Delete a booking
async function deleteBooking(id) {
    const code = prompt("Enter the secret code to delete this booking:");
    if (!code) return;

    const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delete_code: code })
    });

    if (response.ok) {
        loadBookings();
    } else {
        alert("Invalid delete code!");
    }
}

// Helper to show success/error messages
function showMessage(text, type) {
    const box = document.getElementById("message-box");
    box.textContent = text;
    box.className = type; // 'success' or 'error'
    box.style.display = "block";
    setTimeout(() => box.style.display = "none", 4000);
}