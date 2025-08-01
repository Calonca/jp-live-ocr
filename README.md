# jp-live-ocr

A Japanese OCR learning app that uses live camera feed to capture Japanese text and provides dictionary lookups.

## Features

- 📷 **Live Camera Feed**: Access device camera to capture Japanese text
- 🔍 **OCR Processing**: Uses Tesseract.js to extract Japanese text from images  
- 🎯 **JPDB Integration**: Optional integration with jpdb.io for word difficulty analysis
- 📖 **Interactive Dictionary**: Click on recognized words for dictionary lookup
- 🎨 **Word Difficulty Coloring**: Visual indicators for known/learning/new words (with API key)
- 📱 **Mobile Responsive**: Works on both desktop and mobile devices
- 🚀 **GitHub Pages Deployment**: Automatically deployed via GitHub Actions

## Technology Stack

- **Vue.js 3** with TypeScript
- **Tesseract.js** for OCR functionality
- **Vite** for build tooling
- **Vue Router** for navigation
- **Vitest** for testing

## Development

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Calonca/jp-live-ocr.git
   cd jp-live-ocr
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

### Testing

```bash
npm run test:unit
```

### Linting

```bash
npm run lint
npm run format
```

## Usage

1. **Camera Access**: Allow camera permissions when prompted
2. **JPDB Integration**: (Optional) Set your jpdb.io API key for enhanced word analysis
   - Get an API key from [jpdb.io settings](https://jpdb.io/settings)
   - Click the "Setup API Key" button in the app to enter your key
   - With API key: Words are colored by difficulty and learning status
   - Without API key: Basic word splitting and dictionary lookup
3. **Capture Image**: Click the camera button to take a photo
4. **OCR Processing**: Click "Perform OCR" to extract text from the image
5. **Dictionary Lookup**: Click on any word in the OCR results to see dictionary information

## Deployment

The app is automatically deployed to GitHub Pages when changes are pushed to the main branch. The deployment workflow is configured in `.github/workflows/deploy.yml`.

## Camera Permissions

This app requires camera access to function. Make sure to:
- Allow camera permissions in your browser
- Use HTTPS in production (required for camera access)
- On mobile, the app will attempt to use the back camera for better text recognition

## Browser Compatibility

- Modern browsers with MediaDevices API support
- Camera access requires HTTPS (except localhost)
- Supports both desktop and mobile browsers

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).
