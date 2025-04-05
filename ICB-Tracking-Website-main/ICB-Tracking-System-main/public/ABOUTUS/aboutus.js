let currentIndex = 0;
const slides = document.querySelectorAll(".slide");

function showNextSlide() {
    slides[currentIndex].style.opacity = 0;
    currentIndex = (currentIndex + 1) % slides.length;
    slides[currentIndex].style.opacity = 1;
}

setInterval(showNextSlide, 3000);
