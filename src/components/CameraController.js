import React, { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

// Camera controls component
const CameraController = ({ disabled, selectionMode, moveMode, simulationRunning }) => {
  const { camera, gl } = useThree();
  const controls = useRef();
  
  useEffect(() => {
    // Set up camera for better view of the scene
    camera.position.set(0, 18, 18);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    
    return () => {
      if (controls.current) {
        controls.current.dispose();
      }
    };
  }, [camera]);
  
  // Update control state based on props
  useEffect(() => {
    if (!controls.current) return;
    
    // Allow controls during simulation regardless of disabled state
    // But respect selection mode
    const shouldEnableControls = simulationRunning || !disabled;
    controls.current.enabled = shouldEnableControls;
    
    // In selection mode or move mode, disable rotation/pan but allow zoom
    if (selectionMode || moveMode) {
      controls.current.enableRotate = false;
      controls.current.enablePan = false;
      controls.current.enableZoom = true;
    } else {
      // Enable rotation and pan when not in selection or move mode
      controls.current.enableRotate = true;
      controls.current.enablePan = true;
      controls.current.enableZoom = true;
    }
    
    // Configure zoom limits
    controls.current.minDistance = 2;
    controls.current.maxDistance = 100;
    controls.current.maxPolarAngle = Math.PI * 0.85;
    
    // Increase zoom speed for better usability
    controls.current.zoomSpeed = 1.5;
    
    // Damping and rotation speed adjustments
    controls.current.enableDamping = true;
    controls.current.dampingFactor = 0.1;
    controls.current.rotateSpeed = 0.8;
  }, [disabled, selectionMode, moveMode, simulationRunning]);
  
  return (
    <OrbitControls
      ref={controls}
      args={[camera, gl.domElement]}
      enableRotate={!(selectionMode || moveMode)}
      enablePan={!(selectionMode || moveMode)}
      enableZoom={true}
      minDistance={2}
      maxDistance={100}
      minPolarAngle={0}
      maxPolarAngle={Math.PI * 0.85}
      zoomSpeed={1.5}
      dampingFactor={0.1}
      enableDamping={true}
      rotateSpeed={0.8}
    />
  );
};

export default CameraController;
