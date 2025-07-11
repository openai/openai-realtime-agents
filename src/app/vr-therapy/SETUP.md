# VR Therapy 3D Avatar Setup

## Required Dependencies

To enable 3D avatars in the VR therapy experience, you need to install Three.js:

```bash
npm install three @types/three
```

## What This Enables

### 🎭 **3D Avatars**
- **Greeter Agent**: Professional avatar with hair and indigo uniform
- **Virtual Therapist**: Therapist avatar with glasses and emerald uniform
- **Real-time animations**: Floating, head bobbing, and lip sync during speech

### 🎬 **Animations**
- **Lip Sync**: Mouth movements synchronized with speech
- **Idle Animations**: Gentle floating and head bobbing
- **Agent Transitions**: Smooth camera movements between agents
- **Speaking Indicators**: Visual feedback when agents are talking

### 🏠 **3D Environment**
- **Therapy Room**: Calming environment with soft lighting
- **Proper Lighting**: Ambient and directional lights with shadows
- **VR Optimization**: Avatars positioned closer in VR mode

### 🥽 **WebXR Integration**
- **VR Positioning**: Avatars automatically positioned for comfortable VR viewing
- **Spatial Audio**: 3D audio positioning (when available)
- **Quest 3 Optimized**: Designed for Meta Quest 3 browser

## Fallback Behavior

Without Three.js installed:
- ✅ **2D Avatars**: Simple emoji-based avatars (👋 🧠)
- ✅ **Full Functionality**: All therapy features still work
- ✅ **Graceful Degradation**: No errors, just less immersive visuals

## File Structure

```
src/app/vr-therapy/
├── ThreeJSScene.ts          # 3D scene manager
├── VRScene.tsx              # Main scene component (handles both 2D/3D)
├── VRControls.tsx           # VR controls
├── VRTherapyApp.tsx         # Main VR app
└── page.tsx                 # Route handler
```

## Usage

Once Three.js is installed, the VR therapy page will automatically:

1. **Detect Three.js** availability
2. **Initialize 3D scene** with avatars and environment  
3. **Show "✨ 3D Mode Active"** indicator
4. **Animate avatars** during conversations
5. **Switch between agents** with smooth camera transitions

## Browser Compatibility

### **3D Features**
- ✅ Chrome/Edge (Desktop & Quest 3)
- ✅ Firefox (Desktop)
- ✅ Safari (Desktop & iOS)

### **WebXR VR Mode**
- ✅ Meta Quest 3 Browser
- ✅ Chrome with WebXR extensions
- ⚠️ Limited support on other browsers

## Performance

The 3D scene is optimized for VR:
- **Low poly avatars** for smooth performance
- **Efficient animations** using Three.js built-ins
- **Shadow mapping** for realistic lighting
- **LOD considerations** for VR frame rates

## Future Enhancements

Potential upgrades with additional dependencies:

- **GLTF Loader**: Import realistic 3D avatar models
- **Animation Mixer**: Complex facial expressions
- **Physics**: Avatar interactions and gestures
- **Audio Analyzer**: Real-time lip sync from audio
- **Hand Tracking**: Gesture recognition in VR

Install Three.js and refresh the VR therapy page to see the 3D avatars in action! 🎉 