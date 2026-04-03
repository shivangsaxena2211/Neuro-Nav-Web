# NeuroDrive Dashboard (HTML/CSS/JS)

Futuristic real-time dashboard for **EEG / EMG / ECG** visualization (demo stream included) plus a **wheelchair command console** designed to send commands to an **ESP32** (e.g., via WebSocket bridge).

## Run (Windows)

- Open `index.html` in a browser (Edge/Chrome).
- Click **Demo stream** to start the simulated signals.
- Click **Arm** to enable commands. Keyboard: **W/A/S/D**, **Space = STOP**.

## Wiring real data later

This UI expects incoming messages like:

```json
{"t":123,"eeg":0.12,"emg":0.34,"ecg":0.08}
```

or batched arrays:

```json
{"t":123,"eeg":[...],"emg":[...],"ecg":[...]}
```

- **WebSocket**: use the “Connect WebSocket” panel and stream JSON from your ESP32/PC bridge.
- **Serial**: button is a placeholder; implement Web Serial (`navigator.serial`) if you want direct NPG Lite → browser.

