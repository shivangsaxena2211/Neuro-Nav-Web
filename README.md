<div align="center">

# 🧠 NeuroDrive Dashboard

### Futuristic EEG • EMG • ECG Monitoring & Wheelchair Control Interface

*A modern browser-based dashboard for real-time biosignal visualization and intelligent wheelchair command control.*

![HTML](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![ESP32](https://img.shields.io/badge/ESP32-000000?style=for-the-badge&logo=espressif&logoColor=white)

</div>

---

## 📖 Overview

NeuroDrive Dashboard is a futuristic web interface designed for visualizing **EEG, EMG, and ECG** signals in real time while providing an intuitive control panel for an **ESP32-powered smart wheelchair**.

The project simulates live biomedical signals for development and testing and is built to seamlessly integrate with real hardware through **WebSocket communication**.

---

# ✨ Features

- 📈 Live EEG, EMG & ECG signal visualization
- ⚡ Demo stream for testing without hardware
- 🎮 Keyboard-based wheelchair controls
- 🔌 ESP32 WebSocket connectivity
- 📊 Modern cyberpunk-inspired dashboard
- 💻 Lightweight and browser-based
- 🚀 No installation required
- 🔄 Ready for real biomedical sensor integration

---

# 🛠 Tech Stack

| Technology | Purpose |
|------------|---------|
| HTML5 | Structure |
| CSS3 | Styling |
| JavaScript | Dashboard Logic |
| WebSocket | Real-Time Communication |
| ESP32 | Wheelchair Controller |

---

# 📂 Project Structure

```
Neuro-Nav-Web/
│
├── index.html
├── style.css
├── script.js
├── assets/
└── README.md
```

---

# 🚀 Getting Started

## Clone the Repository

```bash
git clone https://github.com/shivangsaxena2211/Neuro-Nav-Web.git
```

```bash
cd Neuro-Nav-Web
```

---

## Run the Dashboard

Simply open

```
index.html
```

inside any modern browser such as

- Google Chrome
- Microsoft Edge
- Brave

No additional dependencies are required.

---

# 🎮 Controls

| Key | Action |
|------|--------|
| W | Forward |
| A | Left |
| S | Reverse |
| D | Right |
| Space | Stop |

Before sending commands:

✔ Click **Arm**

to enable wheelchair control.

---

# 📡 Data Format

The dashboard accepts incoming JSON packets.

### Single Values

```json
{
  "t":123,
  "eeg":0.12,
  "emg":0.34,
  "ecg":0.08
}
```

---

### Batch Values

```json
{
  "t":123,
  "eeg":[...],
  "emg":[...],
  "ecg":[...]
}
```

---

# 🔌 Hardware Integration

The dashboard communicates through WebSockets, allowing easy integration with:

- ESP32
- EEG Modules
- EMG Sensors
- ECG Sensors
- Biomedical Data Bridges

Future support can also include:

- Web Serial API
- Bluetooth Low Energy
- WiFi Streaming
- MQTT

---

# 🎯 Use Cases

- Smart Wheelchair Interfaces
- Brain Computer Interface (BCI)
- Biomedical Signal Monitoring
- Healthcare Dashboards
- Research & Development
- Embedded Systems Projects
- IoT Applications

---

# 🌟 Future Improvements

- AI-based gesture prediction
- Brain signal classification
- Voice assistant integration
- Data recording
- Session playback
- Cloud synchronization
- Dark/Light themes
- Mobile responsive interface

---

# 🤝 Contributing

Contributions are welcome.

If you would like to improve the project:

1. Fork the repository
2. Create a new feature branch
3. Commit your changes
4. Push your branch
5. Open a Pull Request

---

# 📄 License

This project is licensed under the MIT License.

---

# 👨‍💻 Author

**Shivang Saxena**

Computer Science Engineering Student

GitHub:
https://github.com/shivangsaxena2211

---

<div align="center">

### ⭐ If you found this project useful, consider giving it a Star!

Made with ❤️ using HTML, CSS, JavaScript & ESP32

</div>
