const arena = document.querySelector("canvas");
const context = arena?.getContext("2d");

if (arena && context) {
  context.fillStyle = "#f8f9f6";
  context.fillRect(0, 0, arena.width, arena.height);
}
