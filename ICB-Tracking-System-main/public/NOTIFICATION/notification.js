// Function to get today's date and display it
function displayTodayDate() {
    let today = new Date();
    let options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    let formattedDate = today.toLocaleDateString('en-US', options);
    document.getElementById('today-date').textContent = "Today - " + formattedDate;
}

displayTodayDate();
