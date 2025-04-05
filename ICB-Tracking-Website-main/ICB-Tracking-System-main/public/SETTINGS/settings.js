function toggleSubmenu(id) {
    var submenu = document.getElementById(id);
    submenu.style.display = submenu.style.display === "block" ? "none" : "block";
}

function toggleNotifications(btn) {
    if (btn.classList.contains("active")) {
        btn.classList.remove("active");
        btn.textContent = "ON";
    } else {
        btn.classList.add("active");
        btn.textContent = "OFF";
    }
}

function showLogoutPopup() {
    document.getElementById("logout-popup").style.display = "block";
}

function closeLogoutPopup() {
    document.getElementById("logout-popup").style.display = "none";
}

function logout() {
    window.location.href = "logout.html";  // Redirect to logout page
}
