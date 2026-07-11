# Senthil Palanivelu - Personal Portfolio Website

Welcome to the source code repository of my personal portfolio and developer profile website. It features interactive WebGL rendering, custom canvas particle animations, a retro developer console, and real-time environment effects.

## 🚀 Interactive Features

* **3D Gear Simulation**: Powered by Three.js (WebGL), these mechanical gears spin dynamically. Clicking spins them rapidly, and moving your mouse applies a realistic 3D camera tilt.
* **Ambient Weather Simulator**: A custom 2D canvas simulation that generates responsive particle effects (rain with lightning, snow, falling autumn leaves, windy drafts, mist, or shimmering solar dust). It synchronizes automatically with your local time of day.
* **Retro Developer Console**: An interactive terminal widget. Type `help` to list commands or ask questions like *"What are your hobbies?"* or *"Who is Senthil?"* in natural language to receive typed responses.
* **Theme Controller**: Dark and light modes that sync dynamically across standard layout controls, Three.js materials, and weather themes.

---

## 📁 Codebase Structure

The project has been refactored for modularity, separating structure, layout, and behaviors:

```text
├── index.html          # HTML5 layout structure & SEO metadata
├── styles.css          # Styling rules, CSS variables, and layout systems
├── images/             # Profile pictures, icons, and asset graphics
└── js/
    ├── main.js         # Core theme control, navbar scroll-spy, and page orchestration
    ├── gears.js        # Three.js gears scene builder, shaders, and tilt listeners
    ├── terminal.js     # Retro terminal emulator UI, dragging, and Command database
    └── weather.js      # Canvas physics loops, obstacle coordinates caching, and particle engines
```

---

## 🛠️ Local Development & Testing

Since the application uses WebGL and canvas coordinate caching, it is best to view the site through a local web server to avoid CORS issues:

1. Navigate to the root directory in your terminal.
2. Start a simple HTTP server (Python is usually pre-installed):
   ```bash
   python3 -m http.server 8000
   ```
3. Open your browser and navigate to:
   ```text
   http://localhost:8000
   ```

---

## 💻 Tech Stack

* **Structure**: Semantic HTML5
* **Styles**: Vanilla CSS3 (responsive layouts, custom gradients, CSS variables)
* **Animation & Rendering**: JavaScript (ES6+), WebGL via [Three.js](https://threejs.org/)
* **Hosting**: GitHub Pages
