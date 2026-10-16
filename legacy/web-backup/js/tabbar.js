function switchScreen(id) {
  document.querySelectorAll("#customerPhone .screen").forEach((el) => {
    el.classList.remove("active");
  });
  document.getElementById(id).classList.add("active");
  document.querySelectorAll(".tabbar button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.screen === id);
  });
}

window.switchScreen = switchScreen;
